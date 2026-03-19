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
      stats: {
        pageCount: 3,
        chunkCount: 9,
      },
    });

    const loaded = await readWorkspaceManifest(workspaceId);

    expect(loaded).not.toBeNull();
    expect(loaded?.workspaceId).toBe(workspaceId);
    expect(loaded?.stats.chunkCount).toBe(9);
  });
});
