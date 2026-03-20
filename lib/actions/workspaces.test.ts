import { describe, expect, test } from "bun:test";

import {
  runCreateWorkspaceAction,
  runDeleteWorkspaceAction,
} from "@/lib/actions/workspaces";

describe("workspace actions", () => {
  test("validates create workspace input and returns metadata", async () => {
    const result = await runCreateWorkspaceAction(
      {
        createWorkspace: async (url) => ({
          rootUrl: url,
          status: "indexing",
          workspaceId: "18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0",
        }),
      },
      { url: "https://docs.example.com" },
    );

    expect(result).toEqual({
      ok: true,
      rootUrl: "https://docs.example.com",
      status: "indexing",
      workspaceId: "18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0",
    });
  });

  test("rejects invalid create workspace input", async () => {
    const result = await runCreateWorkspaceAction(
      {
        createWorkspace: async () => {
          throw new Error("should not run");
        },
      },
      { url: "" },
    );

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      error: "A URL is required.",
      ok: false,
    });
  });

  test("validates delete workspace input and clears workspace", async () => {
    let deletedId = "";
    const result = await runDeleteWorkspaceAction(
      {
        deleteWorkspace: async (workspaceId) => {
          deletedId = workspaceId;
        },
      },
      { workspaceId: "18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0" },
    );

    expect(result).toEqual({ ok: true });
    expect(deletedId).toBe("18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0");
  });

  test("rejects invalid delete workspace input", async () => {
    const result = await runDeleteWorkspaceAction(
      {
        deleteWorkspace: async () => undefined,
      },
      { workspaceId: "not-a-uuid" },
    );

    expect(result.ok).toBe(false);
    expect(result).toEqual({
      error: "Invalid workspace id.",
      ok: false,
    });
  });
});
