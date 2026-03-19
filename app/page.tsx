"use client";

import { useChat } from "@ai-sdk/react";
import type { FormEvent } from "react";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { ConversationPanel } from "@/components/site-rag/conversation-panel";
import { WORKSPACE_STORAGE_KEY } from "@/components/site-rag/helpers";
import { IndexFlowPanel } from "@/components/site-rag/index-flow-panel";
import { WorkspaceRail } from "@/components/site-rag/workspace-rail";
import type { WorkspaceManifest } from "@/lib/rag/types";

export default function Home() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceManifest | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [prompt, setPrompt] = useState("");

  const {
    messages,
    sendMessage,
    status: chatStatus,
    error: chatError,
    setMessages,
    clearError,
  } = useChat();

  const refreshWorkspace = useEffectEvent(async (nextWorkspaceId: string) => {
    const response = await fetch(`/api/workspaces/${nextWorkspaceId}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
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

    startTransition(() => {
      setWorkspace(json as WorkspaceManifest);
      setWorkspaceUrl((json as WorkspaceManifest).rootUrl);
      setWorkspaceError(null);
    });
  });

  useEffect(() => {
    const savedWorkspaceId = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!savedWorkspaceId) {
      return;
    }

    setWorkspaceId(savedWorkspaceId);
    void refreshWorkspace(savedWorkspaceId);
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
  }, [workspaceId]);

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
      await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      startTransition(() => {
        setWorkspaceId(null);
        setWorkspace(null);
        setMessages([]);
        clearError();
        setWorkspaceError(null);
      });
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "Unable to clear the workspace.",
      );
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
        await fetch(`/api/workspaces/${workspaceId}`, { method: "DELETE" });
      }

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: workspaceUrl }),
      });
      const json = (await response.json()) as
        | { workspaceId: string; status: string }
        | { error?: string };

      if (!response.ok || !("workspaceId" in json)) {
        throw new Error(
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Unable to create a workspace.",
        );
      }

      startTransition(() => {
        setMessages([]);
        clearError();
        setWorkspaceId(json.workspaceId);
        setWorkspace(null);
      });

      await refreshWorkspace(json.workspaceId);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "Unable to create a workspace.",
      );
    } finally {
      setWorkspaceBusy(false);
    }
  }

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim() || !workspaceId || workspace?.status !== "ready") {
      return;
    }

    const nextPrompt = prompt;
    setPrompt("");
    clearError();

    await sendMessage(
      {
        text: nextPrompt,
      },
      {
        body: {
          workspaceId,
        },
      },
    );
  }

  const ready = workspace?.status === "ready";
  const busyChat = chatStatus === "submitted" || chatStatus === "streaming";

  return (
    <div className="h-svh overflow-hidden bg-background">
      <div className="relative h-full overflow-auto md:overflow-hidden">
        <div className="grid min-h-full gap-4 p-3 md:h-full md:min-h-0 md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.95fr)_320px] md:overflow-hidden md:p-4">
          <div className="min-h-[48svh] md:flex md:h-full md:min-h-0">
            <ConversationPanel
              busyChat={busyChat}
              chatError={chatError}
              messages={messages}
              prompt={prompt}
              ready={ready}
              onPromptChange={setPrompt}
              onSubmitPrompt={submitPrompt}
            />
          </div>

          <div className="min-h-[36svh] md:flex md:h-full md:min-h-0">
            <IndexFlowPanel
              workspace={workspace}
              workspaceError={workspaceError}
            />
          </div>

          <div className="min-h-0 md:flex md:h-full md:min-h-0">
            <WorkspaceRail
              workspace={workspace}
              workspaceBusy={workspaceBusy}
              workspaceError={workspaceError}
              workspaceId={workspaceId}
              workspaceUrl={workspaceUrl}
              onClearWorkspace={() => void clearWorkspace()}
              onSubmitWorkspace={submitWorkspace}
              onWorkspaceUrlChange={setWorkspaceUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
