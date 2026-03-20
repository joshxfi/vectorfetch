"use server";

import {
  runCreateWorkspaceAction,
  runDeleteWorkspaceAction,
} from "@/lib/actions/workspaces";
import { createWorkspace, deleteWorkspace } from "@/lib/rag/workspace";

export async function createWorkspaceAction(input: unknown) {
  return runCreateWorkspaceAction(
    {
      createWorkspace,
    },
    input,
  );
}

export async function deleteWorkspaceAction(input: unknown) {
  return runDeleteWorkspaceAction(
    {
      deleteWorkspace,
    },
    input,
  );
}
