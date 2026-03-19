import { randomUUID } from "node:crypto";
import type { ZVecCollection } from "@zvec/zvec";
import { embed, embedMany } from "ai";
import { ollama } from "ai-sdk-ollama";

import {
  appendRecentActivity,
  createActivityEvent,
  mergePipelineProgress,
} from "@/lib/rag/activity";
import {
  EMBEDDING_MODEL,
  MAX_CRAWL_PAGES,
  SEARCH_RESULT_LIMIT,
} from "@/lib/rag/constants";
import { crawlSite } from "@/lib/rag/crawl";
import {
  createWorkspaceManifest,
  ensureWorkspaceStorageRoot,
  readWorkspaceManifest,
  removeWorkspaceStorage,
  writeWorkspaceManifest,
} from "@/lib/rag/manifest";
import { chunkPages } from "@/lib/rag/text";
import type {
  SearchChunkResult,
  WorkspaceManifest,
  WorkspacePipeline,
} from "@/lib/rag/types";
import { normalizeSubmittedUrl, urlPathname } from "@/lib/rag/url";
import {
  closeChunkCollection,
  createChunkCollection,
  openChunkCollection,
  searchChunkCollection,
} from "@/lib/rag/zvec";

type WorkspaceEntry = {
  manifest: WorkspaceManifest;
  collection: ZVecCollection | null;
  job: Promise<void> | null;
  deleted: boolean;
  sync: Promise<void>;
};

declare global {
  var __vectorfetchWorkspaceRegistry: Map<string, WorkspaceEntry> | undefined;
}

function workspaceRegistry() {
  if (!globalThis.__vectorfetchWorkspaceRegistry) {
    globalThis.__vectorfetchWorkspaceRegistry = new Map();
  }

  return globalThis.__vectorfetchWorkspaceRegistry;
}

async function persistEntry(entry: WorkspaceEntry) {
  entry.manifest = await writeWorkspaceManifest(entry.manifest);
  return entry.manifest;
}

async function queueEntryMutation(
  entry: WorkspaceEntry,
  mutate: (
    manifest: WorkspaceManifest,
  ) => WorkspaceManifest | Promise<WorkspaceManifest>,
) {
  const next = entry.sync.then(
    async () => {
      if (entry.deleted) {
        return;
      }

      entry.manifest = await mutate(entry.manifest);
      if (entry.deleted) {
        return;
      }

      await persistEntry(entry);
    },
    async () => {
      if (entry.deleted) {
        return;
      }

      entry.manifest = await mutate(entry.manifest);
      if (entry.deleted) {
        return;
      }

      await persistEntry(entry);
    },
  );

  entry.sync = next.catch(() => undefined);
  await next;
}

function withPipeline(
  manifest: WorkspaceManifest,
  pipeline: Partial<WorkspacePipeline>,
) {
  return {
    ...manifest,
    pipeline: {
      ...manifest.pipeline,
      ...pipeline,
    },
  };
}

function withActivity(
  manifest: WorkspaceManifest,
  activity: Parameters<typeof createActivityEvent>[0],
) {
  return {
    ...manifest,
    recentActivity: appendRecentActivity(
      manifest.recentActivity,
      createActivityEvent(activity),
    ),
  };
}

async function ensureWorkspaceEntry(workspaceId: string) {
  const registry = workspaceRegistry();
  const cached = registry.get(workspaceId);
  if (cached) {
    return cached;
  }

  const manifest = await readWorkspaceManifest(workspaceId);
  if (!manifest) {
    return null;
  }

  const nextEntry: WorkspaceEntry = {
    manifest,
    collection: null,
    job: null,
    deleted: false,
    sync: Promise.resolve(),
  };

  registry.set(workspaceId, nextEntry);
  return nextEntry;
}

async function ensureWorkspaceCollection(entry: WorkspaceEntry) {
  if (entry.collection) {
    return entry.collection;
  }

  entry.collection = openChunkCollection(entry.manifest.collectionPath);
  if (!entry.collection) {
    throw new Error("Workspace index is not available on disk.");
  }

  return entry.collection;
}

async function embedChunkBatch(texts: string[]) {
  const result = await embedMany({
    model: ollama.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  });

  return result.embeddings;
}

async function buildWorkspaceIndex(entry: WorkspaceEntry) {
  const { pages, progress } = await crawlSite({
    rootUrl: entry.manifest.rootUrl,
    maxPages: MAX_CRAWL_PAGES,
    onProgress: async (nextProgress) => {
      await queueEntryMutation(entry, (manifest) => ({
        ...manifest,
        crawl: nextProgress,
        pipeline: mergePipelineProgress(manifest.pipeline, nextProgress),
      }));
    },
    onDiscovered: async (urls) => {
      await queueEntryMutation(entry, (manifest) => {
        let recentActivity = manifest.recentActivity;

        for (const url of urls) {
          recentActivity = appendRecentActivity(
            recentActivity,
            createActivityEvent({
              kind: "discovered",
              phase: "crawling",
              detail: `Discovered ${urlPathname(url)} for crawling.`,
              url,
              path: urlPathname(url),
              title: "Discovered page",
              count: 1,
              progressCurrent: manifest.pipeline.discoveredPages + 1,
              progressTotal: MAX_CRAWL_PAGES,
              summaryKey: "crawl-discovered",
            }),
          );
        }

        return {
          ...manifest,
          recentActivity,
        };
      });
    },
    onPageIndexed: async (page, nextProgress) => {
      await queueEntryMutation(entry, (manifest) =>
        withActivity(
          {
            ...manifest,
            crawl: nextProgress,
            pipeline: mergePipelineProgress(manifest.pipeline, nextProgress),
          },
          {
            kind: "indexed-page",
            phase: "crawling",
            detail: `Scraped readable content from ${page.path}.`,
            url: page.url,
            path: page.path,
            title: page.title,
            count: 1,
            progressCurrent: nextProgress.indexedPages,
            progressTotal: nextProgress.discovered,
            summaryKey: "crawl-indexed",
          },
        ),
      );
    },
    onFailedPage: async (page, nextProgress) => {
      await queueEntryMutation(entry, (manifest) =>
        withActivity(
          {
            ...manifest,
            crawl: nextProgress,
            pipeline: mergePipelineProgress(manifest.pipeline, nextProgress),
          },
          {
            kind: "failed-page",
            phase: "crawling",
            detail: `Failed to crawl ${page.path}.`,
            url: page.url,
            path: page.path,
            title: "Failed page",
            count: 1,
            progressCurrent: nextProgress.failed,
            progressTotal: nextProgress.discovered,
            summaryKey: "crawl-failed",
          },
        ),
      );
    },
  });

  if (entry.deleted) {
    return;
  }

  if (pages.length === 0) {
    throw new Error("Crawl completed without any indexable text pages.");
  }

  await queueEntryMutation(entry, (manifest) => ({
    ...manifest,
    phase: "chunking",
    crawl: progress,
    pipeline: mergePipelineProgress(manifest.pipeline, progress),
    stats: {
      ...manifest.stats,
      pageCount: pages.length,
    },
  }));

  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    throw new Error("The crawled pages did not produce any indexable chunks.");
  }

  const chunkCountsByPage = new Map<number, number>();
  for (const chunk of chunks) {
    chunkCountsByPage.set(
      chunk.pageIndex,
      (chunkCountsByPage.get(chunk.pageIndex) ?? 0) + 1,
    );
  }

  await queueEntryMutation(entry, (manifest) => ({
    ...manifest,
    stats: {
      pageCount: pages.length,
      chunkCount: chunks.length,
    },
  }));

  for (const [pageIndex, page] of pages.entries()) {
    if (entry.deleted) {
      return;
    }

    const chunkCount = chunkCountsByPage.get(pageIndex) ?? 0;
    await queueEntryMutation(entry, (manifest) =>
      withActivity(
        withPipeline(manifest, {
          chunkedPages: pageIndex + 1,
        }),
        {
          kind: "chunked-page",
          phase: "chunking",
          detail: `Split ${page.path} into ${chunkCount} retrievable chunks.`,
          url: page.url,
          path: page.path,
          title: page.title,
          count: chunkCount,
          progressCurrent: pageIndex + 1,
          progressTotal: pages.length,
          summaryKey: "chunk-page",
        },
      ),
    );
  }

  await queueEntryMutation(entry, (manifest) => ({
    ...manifest,
    phase: "embedding",
  }));

  const embeddings: number[][] = [];
  const batchSize = 16;

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const batchEmbeddings = await embedChunkBatch(
      batch.map((chunk) => chunk.text),
    );
    embeddings.push(...batchEmbeddings.map((embedding) => [...embedding]));

    await queueEntryMutation(entry, (manifest) =>
      withActivity(
        withPipeline(manifest, {
          embeddedChunks: Math.min(index + batch.length, chunks.length),
        }),
        {
          kind: "embedded-batch",
          phase: "embedding",
          detail: `Embedded ${Math.min(index + batch.length, chunks.length)} of ${chunks.length} chunks.`,
          count: batch.length,
          progressCurrent: Math.min(index + batch.length, chunks.length),
          progressTotal: chunks.length,
          summaryKey: "embed-progress",
        },
      ),
    );
  }

  if (entry.deleted) {
    return;
  }

  await queueEntryMutation(entry, (manifest) => ({
    ...manifest,
    phase: "storing",
  }));

  closeChunkCollection(entry.collection);
  entry.collection = createChunkCollection({
    collectionPath: entry.manifest.collectionPath,
    chunks,
    embeddings,
  });

  await queueEntryMutation(entry, (manifest) => {
    let nextManifest = withActivity(
      withPipeline(manifest, {
        storedChunks: chunks.length,
      }),
      {
        kind: "stored-batch",
        phase: "storing",
        detail: `Stored ${chunks.length} of ${chunks.length} chunks in zvec.`,
        count: chunks.length,
        progressCurrent: chunks.length,
        progressTotal: chunks.length,
        summaryKey: "store-progress",
      },
    );

    nextManifest = withActivity(
      {
        ...nextManifest,
        status: "ready",
        phase: "ready",
        error: null,
        embeddingDimensions: embeddings[0]?.length ?? null,
        crawl: progress,
        pipeline: {
          ...mergePipelineProgress(nextManifest.pipeline, progress),
          chunkedPages: pages.length,
          embeddedChunks: chunks.length,
          storedChunks: chunks.length,
        },
        stats: {
          pageCount: pages.length,
          chunkCount: chunks.length,
        },
      },
      {
        kind: "completed",
        phase: "ready",
        detail: `Index ready with ${pages.length} pages and ${chunks.length} chunks.`,
        count: chunks.length,
        progressCurrent: chunks.length,
        progressTotal: chunks.length,
        summaryKey: "index-complete",
      },
    );

    return nextManifest;
  });
}

async function runWorkspaceIndexing(workspaceId: string) {
  const entry = await ensureWorkspaceEntry(workspaceId);
  if (!entry) {
    return;
  }

  try {
    await buildWorkspaceIndex(entry);
  } catch (error) {
    if (entry.deleted) {
      return;
    }

    entry.manifest = {
      ...entry.manifest,
      status: "error",
      phase: "error",
      error:
        error instanceof Error
          ? error.message
          : "Failed to build workspace index.",
    };
    await persistEntry(entry);
  } finally {
    const registry = workspaceRegistry();
    const latest = registry.get(workspaceId);
    if (latest) {
      latest.job = null;
    }
  }
}

export async function createWorkspace(rawUrl: string) {
  await ensureWorkspaceStorageRoot();

  const submittedUrl = normalizeSubmittedUrl(rawUrl);
  const workspaceId = randomUUID();
  const manifest = createWorkspaceManifest({
    workspaceId,
    rootUrl: submittedUrl.toString(),
    origin: submittedUrl.origin,
  });

  const entry: WorkspaceEntry = {
    manifest: await writeWorkspaceManifest(manifest),
    collection: null,
    job: null,
    deleted: false,
    sync: Promise.resolve(),
  };

  workspaceRegistry().set(workspaceId, entry);
  entry.job = runWorkspaceIndexing(workspaceId);

  return entry.manifest;
}

export async function getWorkspaceSnapshot(workspaceId: string) {
  const entry = await ensureWorkspaceEntry(workspaceId);
  return entry?.manifest ?? null;
}

export async function deleteWorkspace(workspaceId: string) {
  const registry = workspaceRegistry();
  const entry = await ensureWorkspaceEntry(workspaceId);

  if (entry) {
    entry.deleted = true;
    closeChunkCollection(entry.collection);
  }

  registry.delete(workspaceId);
  await removeWorkspaceStorage(workspaceId);
}

export async function searchWorkspace({
  workspaceId,
  query,
  limit = SEARCH_RESULT_LIMIT,
}: {
  workspaceId: string;
  query: string;
  limit?: number;
}) {
  const entry = await ensureWorkspaceEntry(workspaceId);
  if (!entry) {
    throw new Error("Workspace not found.");
  }

  if (entry.manifest.status !== "ready") {
    throw new Error("Workspace is not ready yet.");
  }

  const collection = await ensureWorkspaceCollection(entry);
  const { embedding } = await embed({
    model: ollama.textEmbeddingModel(EMBEDDING_MODEL),
    value: query,
  });

  return searchChunkCollection({
    collection,
    embedding: [...embedding],
    limit,
  }) satisfies SearchChunkResult[];
}
