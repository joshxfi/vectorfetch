import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  createWorkspaceManifest,
  readWorkspaceManifest,
  removeWorkspaceStorage,
  writeWorkspaceManifest,
} from "@/lib/rag/manifest";

describe("workspace manifests", () => {
  const workspaceIds: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaceIds
        .splice(0)
        .map((workspaceId) => removeWorkspaceStorage(workspaceId)),
    );
  });

  test("writes and reloads a manifest from temp storage", async () => {
    const workspaceId = randomUUID();
    workspaceIds.push(workspaceId);

    const manifest = createWorkspaceManifest({
      workspaceId,
      rootUrl: "https://docs.example.com",
      origin: "https://docs.example.com",
    });

    await writeWorkspaceManifest({
      ...manifest,
      phase: "embedding",
      pipeline: {
        ...manifest.pipeline,
        visitedPages: 3,
        indexedPages: 3,
        chunkedPages: 3,
        embeddedChunks: 9,
      },
      stats: {
        pageCount: 3,
        chunkCount: 9,
      },
      recentActivity: [
        ...manifest.recentActivity,
        {
          id: "activity-1",
          kind: "embedded-batch",
          phase: "embedding",
          at: new Date().toISOString(),
          detail: "Embedded 9 chunks.",
          count: 9,
          progressCurrent: 9,
          progressTotal: 12,
          summaryKey: "embed-progress",
        },
      ],
    });

    const loaded = await readWorkspaceManifest(workspaceId);

    expect(loaded).not.toBeNull();
    expect(loaded?.workspaceId).toBe(workspaceId);
    expect(loaded?.stats.chunkCount).toBe(9);
    expect(loaded?.phase).toBe("embedding");
    expect(loaded?.pipeline.chunkedPages).toBe(3);
    expect(loaded?.recentActivity).toHaveLength(2);
    expect(loaded?.recentActivity[1]?.phase).toBe("embedding");
    expect(loaded?.recentActivity[1]?.progressCurrent).toBe(9);
    expect(loaded?.recentActivity[1]?.summaryKey).toBe("embed-progress");
  });
});
