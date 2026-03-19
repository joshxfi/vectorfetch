import { randomUUID } from "node:crypto";

import type {
  WorkspaceActivityEvent,
  WorkspaceActivityKind,
  WorkspacePhase,
  WorkspacePipeline,
  WorkspaceProgress,
} from "@/lib/rag/types";

const RECENT_ACTIVITY_LIMIT = 40;

type CreateActivityEventInput = {
  kind: WorkspaceActivityKind;
  detail: string;
  phase?: WorkspacePhase;
  url?: string;
  path?: string;
  title?: string;
  count?: number;
  progressCurrent?: number;
  progressTotal?: number;
  summaryKey?: string;
};

export function createWorkspacePipeline(
  progress: Partial<WorkspaceProgress> = {},
): WorkspacePipeline {
  return {
    discoveredPages: progress.discovered ?? 1,
    visitedPages: progress.visited ?? 0,
    indexedPages: progress.indexedPages ?? 0,
    chunkedPages: 0,
    embeddedChunks: 0,
    storedChunks: 0,
    failedPages: progress.failed ?? 0,
  };
}

export function mergePipelineProgress(
  pipeline: WorkspacePipeline,
  progress: WorkspaceProgress,
) {
  return {
    ...pipeline,
    discoveredPages: progress.discovered,
    visitedPages: progress.visited,
    indexedPages: progress.indexedPages,
    failedPages: progress.failed,
  } satisfies WorkspacePipeline;
}

export function createActivityEvent({
  kind,
  detail,
  phase,
  url,
  path,
  title,
  count,
  progressCurrent,
  progressTotal,
  summaryKey,
}: CreateActivityEventInput): WorkspaceActivityEvent {
  return {
    id: randomUUID(),
    kind,
    at: new Date().toISOString(),
    phase,
    url,
    path,
    title,
    detail,
    count,
    progressCurrent,
    progressTotal,
    summaryKey,
  };
}

export function appendRecentActivity(
  recentActivity: WorkspaceActivityEvent[],
  event: WorkspaceActivityEvent,
) {
  return [...recentActivity, event].slice(-RECENT_ACTIVITY_LIMIT);
}
