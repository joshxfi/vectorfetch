import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendRecentActivity,
  createActivityEvent,
  createWorkspacePipeline,
} from "@/lib/rag/activity";
import {
  CHAT_MODEL,
  COLLECTION_DIRNAME,
  EMBEDDING_MODEL,
  MANIFEST_FILENAME,
  MAX_CRAWL_PAGES,
  WORKSPACE_STORAGE_DIRNAME,
} from "@/lib/rag/constants";
import type { WorkspaceManifest } from "@/lib/rag/types";

function nowIso() {
  return new Date().toISOString();
}

export function workspaceRootDir() {
  return path.join(os.tmpdir(), WORKSPACE_STORAGE_DIRNAME);
}

export function workspaceDir(workspaceId: string) {
  return path.join(workspaceRootDir(), workspaceId);
}

export function workspaceManifestPath(workspaceId: string) {
  return path.join(workspaceDir(workspaceId), MANIFEST_FILENAME);
}

export function workspaceCollectionPath(workspaceId: string) {
  return path.join(workspaceDir(workspaceId), COLLECTION_DIRNAME);
}

export async function ensureWorkspaceStorageRoot() {
  await fs.mkdir(workspaceRootDir(), { recursive: true });
}

export function createWorkspaceManifest({
  workspaceId,
  rootUrl,
  origin,
}: {
  workspaceId: string;
  rootUrl: string;
  origin: string;
}): WorkspaceManifest {
  const crawl = {
    discovered: 1,
    visited: 0,
    indexedPages: 0,
    skipped: 0,
    failed: 0,
    limit: MAX_CRAWL_PAGES,
  };

  return {
    workspaceId,
    rootUrl,
    origin,
    status: "indexing",
    phase: "crawling",
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    collectionPath: workspaceCollectionPath(workspaceId),
    embeddingModel: EMBEDDING_MODEL,
    chatModel: CHAT_MODEL,
    embeddingDimensions: null,
    crawl,
    pipeline: createWorkspacePipeline(crawl),
    stats: {
      pageCount: 0,
      chunkCount: 0,
    },
    recentActivity: appendRecentActivity(
      [],
      createActivityEvent({
        kind: "discovered",
        detail: "Queued the root page for crawling.",
        url: rootUrl,
        path: new URL(rootUrl).pathname || "/",
        title: "Root page",
        count: 1,
      }),
    ),
  };
}

function normalizeWorkspaceManifest(
  manifest: Partial<WorkspaceManifest> & Pick<WorkspaceManifest, "workspaceId">,
): WorkspaceManifest {
  const crawl = {
    discovered: manifest.crawl?.discovered ?? 1,
    visited: manifest.crawl?.visited ?? 0,
    indexedPages:
      manifest.crawl?.indexedPages ?? manifest.stats?.pageCount ?? 0,
    skipped: manifest.crawl?.skipped ?? 0,
    failed: manifest.crawl?.failed ?? 0,
    limit: manifest.crawl?.limit ?? MAX_CRAWL_PAGES,
  };
  const stats = {
    pageCount: manifest.stats?.pageCount ?? 0,
    chunkCount: manifest.stats?.chunkCount ?? 0,
  };

  return {
    workspaceId: manifest.workspaceId,
    rootUrl: manifest.rootUrl ?? "",
    origin: manifest.origin ?? "",
    status: manifest.status ?? "indexing",
    phase:
      manifest.phase ??
      (manifest.status === "ready"
        ? "ready"
        : manifest.status === "error"
          ? "error"
          : "crawling"),
    error: manifest.error ?? null,
    createdAt: manifest.createdAt ?? nowIso(),
    updatedAt: manifest.updatedAt ?? nowIso(),
    collectionPath:
      manifest.collectionPath ?? workspaceCollectionPath(manifest.workspaceId),
    embeddingModel: manifest.embeddingModel ?? EMBEDDING_MODEL,
    chatModel: manifest.chatModel ?? CHAT_MODEL,
    embeddingDimensions: manifest.embeddingDimensions ?? null,
    crawl,
    pipeline: {
      ...createWorkspacePipeline(crawl),
      ...(manifest.pipeline ?? {}),
      chunkedPages:
        manifest.pipeline?.chunkedPages ??
        (manifest.status === "ready" ? stats.pageCount : 0),
      embeddedChunks:
        manifest.pipeline?.embeddedChunks ??
        (manifest.status === "ready" ? stats.chunkCount : 0),
      storedChunks:
        manifest.pipeline?.storedChunks ??
        (manifest.status === "ready" ? stats.chunkCount : 0),
    },
    stats,
    recentActivity: manifest.recentActivity ?? [],
  };
}

export async function writeWorkspaceManifest(manifest: WorkspaceManifest) {
  const nextManifest = {
    ...manifest,
    updatedAt: nowIso(),
  };

  await fs.mkdir(workspaceDir(manifest.workspaceId), { recursive: true });
  await fs.writeFile(
    workspaceManifestPath(manifest.workspaceId),
    JSON.stringify(nextManifest, null, 2),
    "utf8",
  );

  return nextManifest;
}

export async function readWorkspaceManifest(workspaceId: string) {
  try {
    const manifest = await fs.readFile(
      workspaceManifestPath(workspaceId),
      "utf8",
    );
    return normalizeWorkspaceManifest(
      JSON.parse(manifest) as Partial<WorkspaceManifest> &
        Pick<WorkspaceManifest, "workspaceId">,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function removeWorkspaceStorage(workspaceId: string) {
  await fs.rm(workspaceDir(workspaceId), { recursive: true, force: true });
}
