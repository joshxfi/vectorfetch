import { describe, expect, test } from "bun:test";

import {
  appendRecentActivity,
  createActivityEvent,
  createWorkspacePipeline,
  mergePipelineProgress,
} from "@/lib/rag/activity";

describe("workspace activity helpers", () => {
  test("keeps only the most recent 40 activity events", () => {
    let activity = [] as ReturnType<typeof appendRecentActivity>;

    for (let index = 0; index < 45; index += 1) {
      activity = appendRecentActivity(
        activity,
        createActivityEvent({
          kind: "discovered",
          detail: `Event ${index}`,
          count: index,
        }),
      );
    }

    expect(activity).toHaveLength(40);
    expect(activity[0]?.detail).toBe("Event 5");
    expect(activity.at(-1)?.detail).toBe("Event 44");
  });

  test("merges crawl progress into the persistent pipeline state", () => {
    const nextPipeline = mergePipelineProgress(createWorkspacePipeline(), {
      discovered: 12,
      visited: 7,
      indexedPages: 5,
      skipped: 1,
      failed: 2,
      limit: 200,
    });

    expect(nextPipeline.discoveredPages).toBe(12);
    expect(nextPipeline.visitedPages).toBe(7);
    expect(nextPipeline.indexedPages).toBe(5);
    expect(nextPipeline.failedPages).toBe(2);
    expect(nextPipeline.chunkedPages).toBe(0);
  });

  test("creates structured progress metadata for grouped activity events", () => {
    const event = createActivityEvent({
      kind: "embedded-batch",
      phase: "embedding",
      detail: "Embedded 64 of 220 chunks.",
      count: 16,
      progressCurrent: 64,
      progressTotal: 220,
      summaryKey: "embed-progress",
    });

    expect(event.phase).toBe("embedding");
    expect(event.progressCurrent).toBe(64);
    expect(event.progressTotal).toBe(220);
    expect(event.summaryKey).toBe("embed-progress");
  });
});
