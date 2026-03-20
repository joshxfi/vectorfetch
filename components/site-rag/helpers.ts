"use client";

import type { UIMessage } from "ai";

import type {
  SearchChunkResult,
  SitePhase,
  SiteSessionManifest,
} from "@/lib/rag/types";

export const ACTIVE_SITE_STORAGE_KEY = "vectorfetch:active-site-id";
export const LEGACY_WORKSPACE_STORAGE_KEY = "vectorfetch:workspace-id";

type SearchToolOutput = {
  query: string;
  results: SearchChunkResult[];
};

const phaseWeights: Record<SitePhase, [number, number]> = {
  crawling: [0, 55],
  chunking: [55, 72],
  embedding: [72, 90],
  storing: [90, 98],
  ready: [100, 100],
  error: [0, 100],
};

export function sitePhaseRatio(site: SiteSessionManifest) {
  switch (site.phase) {
    case "crawling":
      return (
        site.pipeline.visitedPages / Math.max(site.pipeline.discoveredPages, 1)
      );
    case "chunking":
      return site.pipeline.chunkedPages / Math.max(site.stats.pageCount, 1);
    case "embedding":
      return site.pipeline.embeddedChunks / Math.max(site.stats.chunkCount, 1);
    case "storing":
      return site.pipeline.storedChunks / Math.max(site.stats.chunkCount, 1);
    case "ready":
      return 1;
    case "error":
      return site.pipeline.storedChunks > 0 ? 0.98 : 0;
  }
}

export function siteProgressValue(site: SiteSessionManifest | null) {
  if (!site) {
    return 0;
  }

  if (site.status === "ready") {
    return 100;
  }

  const [start, end] = phaseWeights[site.phase];
  const ratio = Math.max(0, Math.min(1, sitePhaseRatio(site)));

  return Math.round(start + (end - start) * ratio);
}

export function siteTone(site: SiteSessionManifest | null) {
  if (!site) {
    return {
      label: "No site indexed",
      variant: "outline" as const,
    };
  }

  if (site.status === "ready") {
    return {
      label: "Ready",
      variant: "secondary" as const,
    };
  }

  if (site.status === "error") {
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

export function siteStatusLine(site: SiteSessionManifest | null) {
  if (!site) {
    return "Submit a root URL to start crawling and indexing a site.";
  }

  if (site.status === "ready") {
    return `${site.stats.pageCount} pages indexed into ${site.stats.chunkCount} local chunks.`;
  }

  if (site.status === "error") {
    return site.error ?? "Indexing failed.";
  }

  switch (site.phase) {
    case "crawling":
      return `Crawling ${site.pipeline.visitedPages}/${Math.max(site.pipeline.discoveredPages, 1)} discovered pages.`;
    case "chunking":
      return `Chunking ${site.pipeline.chunkedPages}/${Math.max(site.stats.pageCount, 1)} scraped pages.`;
    case "embedding":
      return `Embedding ${site.pipeline.embeddedChunks}/${Math.max(site.stats.chunkCount, 1)} chunks locally.`;
    case "storing":
      return `Writing ${site.pipeline.storedChunks}/${Math.max(site.stats.chunkCount, 1)} chunks into zvec.`;
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
