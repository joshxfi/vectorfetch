import { EMBEDDING_MODEL } from "@/lib/rag/constants";
import type {
  SiteActivityEvent,
  SitePhase,
  SiteSessionManifest,
} from "@/lib/rag/types";

export type IndexPhaseVizModel = {
  accentClassName: string;
  activeLineIndex: number;
  animate: boolean;
  caption: string;
  command: string;
  cursorVisible: boolean;
  outputLines: string[];
  phase: SitePhase | "idle";
  prompt: string;
  statusLabel?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function trimLine(value: string | undefined, fallback: string, maxLength = 42) {
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}

function hostLabel(rootUrl: string) {
  try {
    return new URL(rootUrl).hostname;
  } catch {
    return rootUrl;
  }
}

function collectionLabel(collectionPath: string) {
  const parts = collectionPath.split("/").filter(Boolean);

  return parts.at(-1) ?? collectionPath;
}

function latestPhaseEvent(site: SiteSessionManifest, phase: SitePhase) {
  return [...site.recentActivity]
    .reverse()
    .find((event) => event.phase === phase);
}

function lastEventSummary(
  event: SiteActivityEvent | undefined,
  fallback: string,
) {
  if (!event) {
    return fallback;
  }

  if (event.path) {
    return trimLine(event.path, fallback, 34);
  }

  return trimLine(event.detail, fallback, 34);
}

function summarizePhaseOutput(site: SiteSessionManifest) {
  const total = Math.max(site.stats.chunkCount, 1);
  const pages = Math.max(site.stats.pageCount, 1);
  const crawlEvent = latestPhaseEvent(site, "crawling");
  const chunkEvent = latestPhaseEvent(site, "chunking");
  const embedEvent = latestPhaseEvent(site, "embedding");
  const storeEvent = latestPhaseEvent(site, "storing");

  switch (site.phase) {
    case "crawling":
      return {
        prompt: "crawl@local",
        command: `crawl --origin ${hostLabel(site.rootUrl)} --limit ${site.crawl.limit}`,
        outputLines: [
          `[discover] ${site.pipeline.discoveredPages} urls queued`,
          `[visit] ${site.pipeline.visitedPages}/${Math.max(
            site.pipeline.discoveredPages,
            1,
          )} pages fetched`,
          `[accept] ${site.pipeline.indexedPages} html pages accepted`,
          `[target] ${lastEventSummary(crawlEvent, "awaiting next page")}`,
        ],
        statusLabel: "crawling",
      };
    case "chunking":
      return {
        prompt: "chunk@local",
        command: `chunk --pages ${pages} --overlap 200 --window 1200`,
        outputLines: [
          `[build] ${site.pipeline.chunkedPages}/${pages} pages chunked`,
          `[chunks] ${site.stats.chunkCount} candidate chunks`,
          `[source] ${lastEventSummary(chunkEvent, "waiting for page text")}`,
          "[mode] heading-aware chunking enabled",
        ],
        statusLabel: "chunking",
      };
    case "embedding":
      return {
        prompt: "embed@ollama",
        command: `ollama embed ${site.embeddingModel || EMBEDDING_MODEL} --chunks ${total}`,
        outputLines: [
          `[batch] ${site.pipeline.embeddedChunks}/${total} chunks embedded`,
          `[dims] ${site.embeddingDimensions ?? "pending"} dimensions`,
          `[input] ${lastEventSummary(embedEvent, "waiting for chunk batch")}`,
          "[runtime] local ollama embedding session",
        ],
        statusLabel: "embedding",
      };
    case "storing":
      return {
        prompt: "store@zvec",
        command: `zvec insert --collection ${collectionLabel(site.collectionPath)}`,
        outputLines: [
          `[write] ${site.pipeline.storedChunks}/${total} vectors stored`,
          `[engine] zvec in-process collection open`,
          `[source] ${lastEventSummary(storeEvent, "waiting for insert batch")}`,
          `[path] ${trimLine(site.collectionPath, site.collectionPath, 34)}`,
        ],
        statusLabel: "storing",
      };
    case "ready":
      return {
        prompt: "agent@local",
        command: `index ready --site ${hostLabel(site.rootUrl)}`,
        outputLines: [
          `[ready] ${site.stats.pageCount} pages indexed`,
          `[chunks] ${site.stats.chunkCount} retrieval chunks available`,
          `[embed] ${site.embeddingModel}`,
          `[chat] ${site.chatModel}`,
        ],
        statusLabel: "ready",
      };
    case "error":
      return {
        prompt: "index@local",
        command: `index failed --phase ${site.phase}`,
        outputLines: [
          `[error] ${trimLine(site.error ?? "indexing failed", "indexing failed", 34)}`,
          `[failed] ${site.pipeline.failedPages} pages failed`,
          `[phase] ${site.phase}`,
          "[hint] clear the site and retry",
        ],
        statusLabel: "error",
      };
  }
}

export function buildIndexPhaseVizModel(
  site: SiteSessionManifest | null,
  frame: number,
): IndexPhaseVizModel {
  if (!site) {
    return {
      accentClassName: "border-border bg-muted/30",
      activeLineIndex: 1,
      animate: false,
      caption: "Awaiting a root URL to start the local crawl.",
      command: "index --url https://docs.example.com",
      cursorVisible: false,
      outputLines: [
        "[status] waiting for root url",
        "[scope] same-origin public html crawl",
        "[store] temp local zvec collection",
        "[hint] paste a docs site to begin",
      ],
      phase: "idle",
      prompt: "vectorfetch@local",
      statusLabel: "idle",
    };
  }

  const phaseData = summarizePhaseOutput(site);
  const animate = site.status === "indexing";
  const activeLineIndex = clamp(
    frame % Math.max(phaseData.outputLines.length, 1),
    0,
    Math.max(phaseData.outputLines.length - 1, 0),
  );

  return {
    accentClassName:
      site.status === "error"
        ? "border-destructive/30 bg-destructive/8"
        : site.status === "ready"
          ? "border-primary/35 bg-primary/10"
          : site.phase === "crawling"
            ? "border-chart-2/40 bg-chart-2/8"
            : site.phase === "chunking"
              ? "border-chart-3/40 bg-chart-3/8"
              : site.phase === "embedding"
                ? "border-chart-4/40 bg-chart-4/8"
                : "border-primary/30 bg-primary/8",
    activeLineIndex,
    animate,
    caption:
      site.status === "ready"
        ? `${site.stats.pageCount} pages and ${site.stats.chunkCount} chunks are ready for retrieval.`
        : site.status === "error"
          ? site.pipeline.failedPages
            ? `${site.pipeline.failedPages} page${
                site.pipeline.failedPages === 1 ? "" : "s"
              } failed before the index stopped.`
            : "The local index stopped before completion."
          : site.phase === "crawling"
            ? `Visited ${site.pipeline.visitedPages} of ${Math.max(
                site.pipeline.discoveredPages,
                1,
              )} discovered pages.`
            : site.phase === "chunking"
              ? `Chunked ${site.pipeline.chunkedPages} of ${Math.max(
                  site.stats.pageCount,
                  1,
                )} pages into ${site.stats.chunkCount} chunks.`
              : site.phase === "embedding"
                ? `Embedded ${site.pipeline.embeddedChunks} of ${Math.max(
                    site.stats.chunkCount,
                    1,
                  )} chunks into local vectors.`
                : `Stored ${site.pipeline.storedChunks} of ${Math.max(
                    site.stats.chunkCount,
                    1,
                  )} chunks in the zvec collection.`,
    command: phaseData.command,
    cursorVisible: animate ? frame % 2 === 0 : false,
    outputLines: phaseData.outputLines,
    phase: site.phase,
    prompt: phaseData.prompt,
    statusLabel: phaseData.statusLabel,
  };
}
