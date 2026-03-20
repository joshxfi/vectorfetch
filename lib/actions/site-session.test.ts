import { describe, expect, test } from "bun:test";

import {
  runCreateSiteSessionAction,
  runDeleteSiteSessionAction,
} from "@/lib/actions/site-session";

describe("site session actions", () => {
  test("validates create site input and returns metadata", async () => {
    const result = await runCreateSiteSessionAction(
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
      siteId: "18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0",
      status: "indexing",
    });
  });

  test("rejects invalid create site input", async () => {
    const result = await runCreateSiteSessionAction(
      {
        createWorkspace: async () => {
          throw new Error("should not run");
        },
      },
      { url: "" },
    );

    expect(result).toEqual({
      error: "A URL is required.",
      ok: false,
    });
  });

  test("validates clear site input", async () => {
    let deletedId = "";
    const result = await runDeleteSiteSessionAction(
      {
        deleteWorkspace: async (workspaceId) => {
          deletedId = workspaceId;
        },
      },
      { siteId: "18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0" },
    );

    expect(result).toEqual({ ok: true });
    expect(deletedId).toBe("18b2f5c4-8b6d-4b6d-9d96-0e0af63390a0");
  });

  test("rejects invalid clear site input", async () => {
    const result = await runDeleteSiteSessionAction(
      {
        deleteWorkspace: async () => undefined,
      },
      { siteId: "not-a-uuid" },
    );

    expect(result).toEqual({
      error: "Invalid site id.",
      ok: false,
    });
  });
});
