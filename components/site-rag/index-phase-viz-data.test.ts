import { describe, expect, test } from "bun:test";

import { buildIndexPhaseVizModel } from "@/components/site-rag/index-phase-viz-data";
import type { SiteSessionManifest } from "@/lib/rag/types";

function createSite(
  overrides: Partial<SiteSessionManifest> = {},
): SiteSessionManifest {
  return {
    workspaceId: "workspace-1",
    rootUrl: "https://docs.example.com",
    origin: "https://docs.example.com",
    status: "indexing",
    phase: "crawling",
    error: null,
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
    collectionPath: "/tmp/vectorfetch/workspace-1",
    embeddingModel: "qwen3-embedding:0.6b",
    chatModel: "lfm2:24b",
    embeddingDimensions: 1024,
    crawl: {
      discovered: 12,
      visited: 4,
      indexedPages: 3,
      skipped: 0,
      failed: 0,
      limit: 200,
    },
    pipeline: {
      discoveredPages: 12,
      visitedPages: 4,
      indexedPages: 3,
      chunkedPages: 2,
      embeddedChunks: 6,
      storedChunks: 4,
      failedPages: 0,
    },
    stats: {
      pageCount: 9,
      chunkCount: 18,
    },
    recentActivity: [
      {
        id: "event-1",
        kind: "indexed-page",
        at: "2026-03-20T00:00:01.000Z",
        phase: "crawling",
        path: "/docs/getting-started",
        detail: "Indexed page /docs/getting-started.",
      },
    ],
    ...overrides,
  };
}

describe("index phase viz data", () => {
  test("renders an idle terminal prompt when no site is active", () => {
    const model = buildIndexPhaseVizModel(null, 0);

    expect(model.phase).toBe("idle");
    expect(model.animate).toBe(false);
    expect(model.prompt).toBe("vectorfetch@local");
    expect(model.command).toContain("index --url");
    expect(model.outputLines[0]).toContain("waiting for root url");
  });

  test("builds a crawl command and crawl-specific output", () => {
    const model = buildIndexPhaseVizModel(createSite(), 2);

    expect(model.phase).toBe("crawling");
    expect(model.animate).toBe(true);
    expect(model.prompt).toBe("crawl@local");
    expect(model.command).toContain("crawl --origin docs.example.com");
    expect(model.outputLines[0]).toContain("urls queued");
    expect(model.outputLines[3]).toContain("/docs/getting-st");
  });

  test("changes the embedding terminal cursor or active line as frames advance", () => {
    const site = createSite({
      phase: "embedding",
      pipeline: {
        discoveredPages: 12,
        visitedPages: 12,
        indexedPages: 9,
        chunkedPages: 9,
        embeddedChunks: 12,
        storedChunks: 4,
        failedPages: 0,
      },
      recentActivity: [
        {
          id: "event-2",
          kind: "embedded-batch",
          at: "2026-03-20T00:00:02.000Z",
          phase: "embedding",
          path: "/pricing",
          detail: "Embedded 12 of 18 chunks.",
        },
      ],
    });

    const frameA = buildIndexPhaseVizModel(site, 0);
    const frameB = buildIndexPhaseVizModel(site, 1);

    expect(frameA.phase).toBe("embedding");
    expect(frameA.command).toContain("ollama embed");
    expect(frameA.outputLines[0]).toContain("12/18 chunks embedded");
    expect(frameA.cursorVisible).not.toBe(frameB.cursorVisible);
  });

  test("renders a stable ready terminal state", () => {
    const model = buildIndexPhaseVizModel(
      createSite({
        status: "ready",
        phase: "ready",
        pipeline: {
          discoveredPages: 12,
          visitedPages: 12,
          indexedPages: 9,
          chunkedPages: 9,
          embeddedChunks: 18,
          storedChunks: 18,
          failedPages: 0,
        },
      }),
      7,
    );

    expect(model.phase).toBe("ready");
    expect(model.animate).toBe(false);
    expect(model.prompt).toBe("agent@local");
    expect(model.command).toContain("index ready");
    expect(model.outputLines[0]).toContain("pages indexed");
  });

  test("renders a stable error terminal state", () => {
    const model = buildIndexPhaseVizModel(
      createSite({
        status: "error",
        phase: "error",
        error: "Embedding process failed",
        pipeline: {
          discoveredPages: 12,
          visitedPages: 8,
          indexedPages: 6,
          chunkedPages: 5,
          embeddedChunks: 0,
          storedChunks: 0,
          failedPages: 2,
        },
      }),
      3,
    );

    expect(model.phase).toBe("error");
    expect(model.animate).toBe(false);
    expect(model.command).toContain("index failed");
    expect(model.outputLines[0]).toContain("Embedding process failed");
    expect(model.outputLines[3]).toContain("retry");
  });

  test("produces distinct commands for chunking and storing", () => {
    const chunk = buildIndexPhaseVizModel(createSite({ phase: "chunking" }), 1);
    const store = buildIndexPhaseVizModel(
      createSite({
        phase: "storing",
        pipeline: {
          discoveredPages: 12,
          visitedPages: 12,
          indexedPages: 9,
          chunkedPages: 9,
          embeddedChunks: 18,
          storedChunks: 12,
          failedPages: 0,
        },
        recentActivity: [
          {
            id: "event-3",
            kind: "stored-batch",
            at: "2026-03-20T00:00:03.000Z",
            phase: "storing",
            path: "/support",
            detail: "Stored 12 of 18 chunks.",
          },
        ],
      }),
      1,
    );

    expect(chunk.command).toContain("chunk --pages");
    expect(store.command).toContain("zvec insert");
    expect(chunk.outputLines).not.toEqual(store.outputLines);
  });
});
