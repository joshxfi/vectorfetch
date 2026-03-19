export type WorkspaceStatus = "indexing" | "ready" | "error";

export interface WorkspaceProgress {
  discovered: number;
  visited: number;
  indexedPages: number;
  skipped: number;
  failed: number;
  limit: number;
}

export interface WorkspaceStats {
  pageCount: number;
  chunkCount: number;
}

export interface WorkspaceManifest {
  workspaceId: string;
  rootUrl: string;
  origin: string;
  status: WorkspaceStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  collectionPath: string;
  embeddingModel: string;
  chatModel: string;
  embeddingDimensions: number | null;
  crawl: WorkspaceProgress;
  stats: WorkspaceStats;
}

export interface CrawledPage {
  url: string;
  path: string;
  title: string;
  text: string;
  contentHash: string;
}

export interface ChunkRecord {
  id: string;
  url: string;
  path: string;
  title: string;
  text: string;
  chunkIndex: number;
  pageIndex: number;
}

export interface SearchChunkResult extends ChunkRecord {
  score: number;
}
