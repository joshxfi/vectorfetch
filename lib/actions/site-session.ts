import { z } from "zod";

import type { SiteStatus } from "@/lib/rag/types";

const createSiteSessionActionSchema = z.object({
  url: z.string().min(1, "A URL is required."),
});

const deleteSiteSessionActionSchema = z.object({
  siteId: z.string().uuid("Invalid site id."),
});

type CreateSiteSessionDeps = {
  createWorkspace: (url: string) => Promise<{
    workspaceId: string;
    status: SiteStatus;
    rootUrl: string;
  }>;
};

type DeleteSiteSessionDeps = {
  deleteWorkspace: (workspaceId: string) => Promise<void>;
};

export type CreateSiteSessionActionResult =
  | {
      ok: true;
      rootUrl: string;
      siteId: string;
      status: SiteStatus;
    }
  | {
      error: string;
      ok: false;
    };

export type DeleteSiteSessionActionResult =
  | {
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export async function runCreateSiteSessionAction(
  deps: CreateSiteSessionDeps,
  input: unknown,
): Promise<CreateSiteSessionActionResult> {
  const parsed = createSiteSessionActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid site request.",
      ok: false,
    };
  }

  try {
    const session = await deps.createWorkspace(parsed.data.url);

    return {
      ok: true,
      rootUrl: session.rootUrl,
      siteId: session.workspaceId,
      status: session.status,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create a local site session.",
      ok: false,
    };
  }
}

export async function runDeleteSiteSessionAction(
  deps: DeleteSiteSessionDeps,
  input: unknown,
): Promise<DeleteSiteSessionActionResult> {
  const parsed = deleteSiteSessionActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid site id.",
      ok: false,
    };
  }

  try {
    await deps.deleteWorkspace(parsed.data.siteId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to clear the site.",
      ok: false,
    };
  }
}
