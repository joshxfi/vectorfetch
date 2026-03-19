"use client";

import type { UIMessage } from "ai";

import type {
  SearchChunkResult,
  WorkspaceManifest,
  WorkspacePhase,
} from "@/lib/rag/types";

export const WORKSPACE_STORAGE_KEY = "vectorfetch:workspace-id";

type SearchToolOutput = {
  query: string;
  results: SearchChunkResult[];
};

const phaseWeights: Record<WorkspacePhase, [number, number]> = {
  crawling: [0, 55],
  chunking: [55, 72],
  embedding: [72, 90],
  storing: [90, 98],
  ready: [100, 100],
  error: [0, 100],
};

export function workspacePhaseRatio(workspace: WorkspaceManifest) {
  switch (workspace.phase) {
    case "crawling":
      return (
        workspace.pipeline.visitedPages /
        Math.max(workspace.pipeline.discoveredPages, 1)
      );
    case "chunking":
      return (
        workspace.pipeline.chunkedPages / Math.max(workspace.stats.pageCount, 1)
      );
    case "embedding":
      return (
        workspace.pipeline.embeddedChunks /
        Math.max(workspace.stats.chunkCount, 1)
      );
    case "storing":
      return (
        workspace.pipeline.storedChunks /
        Math.max(workspace.stats.chunkCount, 1)
      );
    case "ready":
      return 1;
    case "error":
      return workspace.pipeline.storedChunks > 0 ? 0.98 : 0;
  }
}

export function workspaceProgressValue(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return 0;
  }

  if (workspace.status === "ready") {
    return 100;
  }

  const [start, end] = phaseWeights[workspace.phase];
  const ratio = Math.max(0, Math.min(1, workspacePhaseRatio(workspace)));

  return Math.round(start + (end - start) * ratio);
}

export function workspaceTone(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return {
      label: "No site indexed",
      variant: "outline" as const,
    };
  }

  if (workspace.status === "ready") {
    return {
      label: "Ready",
      variant: "secondary" as const,
    };
  }

  if (workspace.status === "error") {
    return {
      label: "Needs attention",
      variant: "destructive" as const,
    };
  }

  return {
    label: "Indexing",
    variant: "outline" as const,
  };
}

export function statusLine(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return "Submit a root URL to start crawling and indexing a site.";
  }

  if (workspace.status === "ready") {
    return `${workspace.stats.pageCount} pages indexed into ${workspace.stats.chunkCount} local chunks.`;
  }

  if (workspace.status === "error") {
    return workspace.error ?? "Indexing failed.";
  }

  switch (workspace.phase) {
    case "crawling":
      return `Crawling ${workspace.pipeline.visitedPages}/${Math.max(
        workspace.pipeline.discoveredPages,
        1,
      )} discovered pages.`;
    case "chunking":
      return `Chunking ${workspace.pipeline.chunkedPages}/${Math.max(
        workspace.stats.pageCount,
        1,
      )} scraped pages.`;
    case "embedding":
      return `Embedding ${workspace.pipeline.embeddedChunks}/${Math.max(
        workspace.stats.chunkCount,
        1,
      )} chunks locally.`;
    case "storing":
      return `Writing ${workspace.pipeline.storedChunks}/${Math.max(
        workspace.stats.chunkCount,
        1,
      )} chunks into zvec.`;
    default:
      return "Preparing the local index.";
  }
}

export function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function messageSearchOutputs(message: UIMessage) {
  return message.parts.flatMap((part) => {
    if (
      part.type !== "tool-searchSiteContext" ||
      part.state !== "output-available"
    ) {
      return [];
    }

    return [part.output as SearchToolOutput];
  });
}

export function messageSources(message: UIMessage) {
  const seen = new Set<string>();
  const sources: SearchChunkResult[] = [];

  for (const output of messageSearchOutputs(message)) {
    for (const result of output.results) {
      if (seen.has(result.url)) {
        continue;
      }

      seen.add(result.url);
      sources.push(result);
    }
  }

  return sources;
}
