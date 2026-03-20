export type WorkspaceStatus = "indexing" | "ready" | "error";
export type WorkspacePhase =
  | "crawling"
  | "chunking"
  | "embedding"
  | "storing"
  | "ready"
  | "error";

export type WorkspaceActivityKind =
  | "discovered"
  | "indexed-page"
  | "chunked-page"
  | "embedded-batch"
  | "stored-batch"
  | "failed-page"
  | "completed";

export interface WorkspaceProgress {
  discovered: number;
  visited: number;
  indexedPages: number;
  skipped: number;
  failed: number;
  limit: number;
}

export interface WorkspacePipeline {
  discoveredPages: number;
  visitedPages: number;
  indexedPages: number;
  chunkedPages: number;
  embeddedChunks: number;
  storedChunks: number;
  failedPages: number;
}

export interface WorkspaceActivityEvent {
  id: string;
  kind: WorkspaceActivityKind;
  at: string;
  phase?: WorkspacePhase;
  url?: string;
  path?: string;
  title?: string;
  detail: string;
  count?: number;
  progressCurrent?: number;
  progressTotal?: number;
  summaryKey?: string;
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
  phase: WorkspacePhase;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  collectionPath: string;
  embeddingModel: string;
  chatModel: string;
  embeddingDimensions: number | null;
  crawl: WorkspaceProgress;
  pipeline: WorkspacePipeline;
  stats: WorkspaceStats;
  recentActivity: WorkspaceActivityEvent[];
}

export type SiteStatus = WorkspaceStatus;
export type SitePhase = WorkspacePhase;
export type SiteActivityKind = WorkspaceActivityKind;
export type SiteProgress = WorkspaceProgress;
export type SitePipeline = WorkspacePipeline;
export type SiteActivityEvent = WorkspaceActivityEvent;
export type SiteStats = WorkspaceStats;
export type SiteSessionManifest = WorkspaceManifest;

export interface CrawledPage {
  url: string;
  path: string;
  title: string;
  text: string;
  contentHash: string;
}

export interface CrawlFailure {
  url: string;
  path: string;
  statusCode: number | null;
  blocked: boolean;
  message: string;
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
