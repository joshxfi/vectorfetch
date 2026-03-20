"use client";

import { useChat } from "@ai-sdk/react";
import type { FormEvent } from "react";
import { useState } from "react";

import { ConversationPanel } from "@/components/site-rag/conversation-panel";
import { IndexFlowPanel } from "@/components/site-rag/index-flow-panel";
import { useWorkspaceSession } from "@/components/site-rag/use-workspace-session";
import { WorkspaceRail } from "@/components/site-rag/workspace-rail";

export function SiteRagShell() {
  const [prompt, setPrompt] = useState("");
  const {
    messages,
    sendMessage,
    status: chatStatus,
    error: chatError,
    setMessages,
    clearError,
  } = useChat();

  const {
    clearWorkspace,
    submitWorkspace,
    workspace,
    workspaceBusy,
    workspaceError,
    workspaceId,
    workspaceUrl,
    setWorkspaceUrl,
  } = useWorkspaceSession({
    onConversationReset: () => {
      setMessages([]);
      clearError();
    },
  });

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
