import { randomUUID } from "node:crypto";
import type { ZVecCollection } from "@zvec/zvec";
import { embed, embedMany } from "ai";
import { ollama } from "ai-sdk-ollama";

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
import type { SearchChunkResult, WorkspaceManifest } from "@/lib/rag/types";
import { normalizeSubmittedUrl } from "@/lib/rag/url";
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
      if (entry.deleted) {
        return;
      }

      entry.manifest = {
        ...entry.manifest,
        crawl: nextProgress,
      };
      await persistEntry(entry);
    },
  });

  if (entry.deleted) {
    return;
  }

  if (pages.length === 0) {
    throw new Error("Crawl completed without any indexable text pages.");
  }

  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    throw new Error("The crawled pages did not produce any indexable chunks.");
  }

  const embeddings: number[][] = [];
  const batchSize = 16;

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const batchEmbeddings = await embedChunkBatch(
      batch.map((chunk) => chunk.text),
    );
    embeddings.push(...batchEmbeddings.map((embedding) => [...embedding]));
  }

  if (entry.deleted) {
    return;
  }

  closeChunkCollection(entry.collection);
  entry.collection = createChunkCollection({
    collectionPath: entry.manifest.collectionPath,
    chunks,
    embeddings,
  });
  entry.manifest = {
    ...entry.manifest,
    status: "ready",
    error: null,
    embeddingDimensions: embeddings[0]?.length ?? null,
    crawl: progress,
    stats: {
      pageCount: pages.length,
      chunkCount: chunks.length,
    },
  };
  await persistEntry(entry);
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
