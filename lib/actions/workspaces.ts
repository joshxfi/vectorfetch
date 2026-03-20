import { z } from "zod";

import type { WorkspaceStatus } from "@/lib/rag/types";

const createWorkspaceActionSchema = z.object({
  url: z.string().min(1, "A URL is required."),
});

const deleteWorkspaceActionSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace id."),
});

type CreateWorkspaceDeps = {
  createWorkspace: (url: string) => Promise<{
    workspaceId: string;
    status: WorkspaceStatus;
    rootUrl: string;
  }>;
};

type DeleteWorkspaceDeps = {
  deleteWorkspace: (workspaceId: string) => Promise<void>;
};

export type CreateWorkspaceActionResult =
  | {
      ok: true;
      rootUrl: string;
      status: WorkspaceStatus;
      workspaceId: string;
    }
  | {
      error: string;
      ok: false;
    };

export type DeleteWorkspaceActionResult =
  | {
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };

export async function runCreateWorkspaceAction(
  deps: CreateWorkspaceDeps,
  input: unknown,
): Promise<CreateWorkspaceActionResult> {
  const parsed = createWorkspaceActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace request.",
      ok: false,
    };
  }

  try {
    const workspace = await deps.createWorkspace(parsed.data.url);

    return {
      ok: true,
      rootUrl: workspace.rootUrl,
      status: workspace.status,
      workspaceId: workspace.workspaceId,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create a website workspace.",
      ok: false,
    };
  }
}

export async function runDeleteWorkspaceAction(
  deps: DeleteWorkspaceDeps,
  input: unknown,
): Promise<DeleteWorkspaceActionResult> {
  const parsed = deleteWorkspaceActionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace id.",
      ok: false,
    };
  }

  try {
    await deps.deleteWorkspace(parsed.data.workspaceId);
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to clear workspace.",
      ok: false,
    };
  }
}
