"use client";

import type { FormEvent } from "react";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  createWorkspaceAction,
  deleteWorkspaceAction,
} from "@/app/actions/workspaces";
import { WORKSPACE_STORAGE_KEY } from "@/components/site-rag/helpers";
import type { WorkspaceManifest } from "@/lib/rag/types";

type UseWorkspaceSessionOptions = {
  onConversationReset?: () => void;
};

export function useWorkspaceSession({
  onConversationReset,
}: UseWorkspaceSessionOptions = {}) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceManifest | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);

  const rememberWorkspaceId = useEffectEvent(
    (nextWorkspaceId: string | null) => {
      if (nextWorkspaceId) {
        window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
      } else {
        window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      }
    },
  );

  const refreshWorkspace = useEffectEvent(async (nextWorkspaceId: string) => {
    const response = await fetch(`/api/workspaces/${nextWorkspaceId}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      rememberWorkspaceId(null);
      startTransition(() => {
        setWorkspaceId(null);
        setWorkspace(null);
        setWorkspaceError(
          "The previous local workspace is no longer available.",
        );
      });
      return;
    }

    const json = (await response.json()) as
      | WorkspaceManifest
      | { error?: string };

    if (!response.ok) {
      startTransition(() => {
        setWorkspaceError(
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Unable to load the current workspace.",
        );
      });
      return;
    }

    const nextWorkspace = json as WorkspaceManifest;
    startTransition(() => {
      setWorkspace(nextWorkspace);
      setWorkspaceUrl(nextWorkspace.rootUrl);
      setWorkspaceError(null);
    });
  });

  useEffect(() => {
    const savedWorkspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!savedWorkspaceId) {
      return;
    }

    startTransition(() => {
      setWorkspaceId(savedWorkspaceId);
    });
    void refreshWorkspace(savedWorkspaceId);
  }, []);

  useEffect(() => {
    if (!workspaceId || workspace?.status !== "indexing") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshWorkspace(workspaceId);
    }, 1200);

    return () => {
      window.clearInterval(interval);
    };
  }, [workspace?.status, workspaceId]);

  async function clearWorkspace() {
    if (!workspaceId) {
      return;
    }

    setWorkspaceBusy(true);

    try {
      const result = await deleteWorkspaceAction({ workspaceId });
      if (!result.ok) {
        setWorkspaceError(result.error);
        return;
      }

      rememberWorkspaceId(null);
      startTransition(() => {
        onConversationReset?.();
        setWorkspaceId(null);
        setWorkspace(null);
        setWorkspaceError(null);
      });
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceUrl.trim()) {
      setWorkspaceError("Enter a website URL to index.");
      return;
    }

    setWorkspaceBusy(true);
    setWorkspaceError(null);

    try {
      if (workspaceId) {
        const deleteResult = await deleteWorkspaceAction({ workspaceId });
        if (!deleteResult.ok) {
          setWorkspaceError(deleteResult.error);
          return;
        }

        rememberWorkspaceId(null);
        startTransition(() => {
          onConversationReset?.();
          setWorkspaceId(null);
          setWorkspace(null);
        });
      }

      const result = await createWorkspaceAction({ url: workspaceUrl });
      if (!result.ok) {
        setWorkspaceError(result.error);
        return;
      }

      rememberWorkspaceId(result.workspaceId);
      startTransition(() => {
        onConversationReset?.();
        setWorkspaceId(result.workspaceId);
        setWorkspace(null);
        setWorkspaceUrl(result.rootUrl);
        setWorkspaceError(null);
      });

      await refreshWorkspace(result.workspaceId);
    } finally {
      setWorkspaceBusy(false);
    }
  }

  return {
    clearWorkspace,
    refreshWorkspace,
    submitWorkspace,
    workspace,
    workspaceBusy,
    workspaceError,
    workspaceId,
    workspaceUrl,
    setWorkspaceUrl,
  };
}
