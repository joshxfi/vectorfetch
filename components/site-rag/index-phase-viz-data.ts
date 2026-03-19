import type {
  WorkspaceActivityEvent,
  WorkspaceManifest,
  WorkspacePhase,
} from "@/lib/rag/types";

export type IndexPhaseVizModel = {
  accentClassName: string;
  activeLineIndex: number;
  animate: boolean;
  caption: string;
  command: string;
  cursorVisible: boolean;
  outputLines: string[];
  phase: WorkspacePhase | "idle";
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

function latestPhaseEvent(workspace: WorkspaceManifest, phase: WorkspacePhase) {
  return [...workspace.recentActivity]
    .reverse()
    .find((event) => event.phase === phase);
}

function lastEventSummary(
  event: WorkspaceActivityEvent | undefined,
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

function summarizePhaseOutput(workspace: WorkspaceManifest) {
  const total = Math.max(workspace.stats.chunkCount, 1);
  const pages = Math.max(workspace.stats.pageCount, 1);
  const crawlEvent = latestPhaseEvent(workspace, "crawling");
  const chunkEvent = latestPhaseEvent(workspace, "chunking");
  const embedEvent = latestPhaseEvent(workspace, "embedding");
  const storeEvent = latestPhaseEvent(workspace, "storing");

  switch (workspace.phase) {
    case "crawling":
      return {
        prompt: "crawl@local",
        command: `crawl --origin ${hostLabel(workspace.rootUrl)} --limit ${workspace.crawl.limit}`,
        outputLines: [
          `[discover] ${workspace.pipeline.discoveredPages} urls queued`,
          `[visit] ${workspace.pipeline.visitedPages}/${Math.max(
            workspace.pipeline.discoveredPages,
            1,
          )} pages fetched`,
          `[accept] ${workspace.pipeline.indexedPages} html pages accepted`,
          `[target] ${lastEventSummary(crawlEvent, "awaiting next page")}`,
        ],
        statusLabel: "crawling",
      };
    case "chunking":
      return {
        prompt: "chunk@local",
        command: `chunk --pages ${pages} --overlap 200 --window 1200`,
        outputLines: [
          `[build] ${workspace.pipeline.chunkedPages}/${pages} pages chunked`,
          `[chunks] ${workspace.stats.chunkCount} candidate chunks`,
          `[source] ${lastEventSummary(chunkEvent, "waiting for page text")}`,
          "[mode] heading-aware chunking enabled",
        ],
        statusLabel: "chunking",
      };
    case "embedding":
      return {
        prompt: "embed@ollama",
        command: `ollama embed qwen3-embedding:0.6b --chunks ${total}`,
        outputLines: [
          `[batch] ${workspace.pipeline.embeddedChunks}/${total} chunks embedded`,
          `[dims] ${workspace.embeddingDimensions ?? "pending"} dimensions`,
          `[input] ${lastEventSummary(embedEvent, "waiting for chunk batch")}`,
          "[runtime] local ollama embedding session",
        ],
        statusLabel: "embedding",
      };
    case "storing":
      return {
        prompt: "store@zvec",
        command: `zvec insert --collection ${collectionLabel(workspace.collectionPath)}`,
        outputLines: [
          `[write] ${workspace.pipeline.storedChunks}/${total} vectors stored`,
          `[engine] zvec in-process collection open`,
          `[source] ${lastEventSummary(storeEvent, "waiting for insert batch")}`,
          `[path] ${trimLine(workspace.collectionPath, workspace.collectionPath, 34)}`,
        ],
        statusLabel: "storing",
      };
    case "ready":
      return {
        prompt: "agent@local",
        command: `index ready --site ${hostLabel(workspace.rootUrl)}`,
        outputLines: [
          `[ready] ${workspace.stats.pageCount} pages indexed`,
          `[chunks] ${workspace.stats.chunkCount} retrieval chunks available`,
          `[embed] ${workspace.embeddingModel}`,
          `[chat] ${workspace.chatModel}`,
        ],
        statusLabel: "ready",
      };
    case "error":
      return {
        prompt: "index@local",
        command: `index failed --phase ${workspace.phase}`,
        outputLines: [
          `[error] ${trimLine(workspace.error ?? "indexing failed", "indexing failed", 34)}`,
          `[failed] ${workspace.pipeline.failedPages} pages failed`,
          `[phase] ${workspace.phase}`,
          "[hint] clear workspace and retry",
        ],
        statusLabel: "error",
      };
  }
}

export function buildIndexPhaseVizModel(
  workspace: WorkspaceManifest | null,
  frame: number,
): IndexPhaseVizModel {
  if (!workspace) {
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

  const phaseData = summarizePhaseOutput(workspace);
  const animate = workspace.status === "indexing";
  const activeLineIndex = clamp(
    frame % Math.max(phaseData.outputLines.length, 1),
    0,
    Math.max(phaseData.outputLines.length - 1, 0),
  );

  return {
    accentClassName:
      workspace.status === "error"
        ? "border-destructive/30 bg-destructive/8"
        : workspace.status === "ready"
          ? "border-primary/35 bg-primary/10"
          : workspace.phase === "crawling"
            ? "border-chart-2/40 bg-chart-2/8"
            : workspace.phase === "chunking"
              ? "border-chart-3/40 bg-chart-3/8"
              : workspace.phase === "embedding"
                ? "border-chart-4/40 bg-chart-4/8"
                : "border-primary/30 bg-primary/8",
    activeLineIndex,
    animate,
    caption:
      workspace.status === "ready"
        ? `${workspace.stats.pageCount} pages and ${workspace.stats.chunkCount} chunks are ready for retrieval.`
        : workspace.status === "error"
          ? workspace.pipeline.failedPages
            ? `${workspace.pipeline.failedPages} page${
                workspace.pipeline.failedPages === 1 ? "" : "s"
              } failed before the index stopped.`
            : "The local index stopped before completion."
          : workspace.phase === "crawling"
            ? `Visited ${workspace.pipeline.visitedPages} of ${Math.max(
                workspace.pipeline.discoveredPages,
                1,
              )} discovered pages.`
            : workspace.phase === "chunking"
              ? `Chunked ${workspace.pipeline.chunkedPages} of ${Math.max(
                  workspace.stats.pageCount,
                  1,
                )} pages into ${workspace.stats.chunkCount} chunks.`
              : workspace.phase === "embedding"
                ? `Embedded ${workspace.pipeline.embeddedChunks} of ${Math.max(
                    workspace.stats.chunkCount,
                    1,
                  )} chunks into local vectors.`
                : `Stored ${workspace.pipeline.storedChunks} of ${Math.max(
                    workspace.stats.chunkCount,
                    1,
                  )} chunks in the zvec collection.`,
    command: phaseData.command,
    cursorVisible: animate ? frame % 2 === 0 : false,
    outputLines: phaseData.outputLines,
    phase: workspace.phase,
    prompt: phaseData.prompt,
    statusLabel: phaseData.statusLabel,
  };
}
