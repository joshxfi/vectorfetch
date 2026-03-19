import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

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
  return {
    workspaceId,
    rootUrl,
    origin,
    status: "indexing",
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    collectionPath: workspaceCollectionPath(workspaceId),
    embeddingModel: EMBEDDING_MODEL,
    chatModel: CHAT_MODEL,
    embeddingDimensions: null,
    crawl: {
      discovered: 1,
      visited: 0,
      indexedPages: 0,
      skipped: 0,
      failed: 0,
      limit: MAX_CRAWL_PAGES,
    },
    stats: {
      pageCount: 0,
      chunkCount: 0,
    },
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
    return JSON.parse(manifest) as WorkspaceManifest;
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
