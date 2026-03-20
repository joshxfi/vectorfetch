"use server";

import {
  runCreateSiteSessionAction,
  runDeleteSiteSessionAction,
} from "@/lib/actions/site-session";
import { createWorkspace, deleteWorkspace } from "@/lib/rag/workspace";

export async function createSiteSessionAction(input: unknown) {
  return runCreateSiteSessionAction(
    {
      createWorkspace,
    },
    input,
  );
}

export async function deleteSiteSessionAction(input: unknown) {
  return runDeleteSiteSessionAction(
    {
      deleteWorkspace,
    },
    input,
  );
}
