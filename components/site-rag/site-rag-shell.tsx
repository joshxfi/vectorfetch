"use client";

import { useChat } from "@ai-sdk/react";
import type { FormEvent } from "react";
import { useState } from "react";

import { ConversationPanel } from "@/components/site-rag/conversation-panel";
import { IndexFlowPanel } from "@/components/site-rag/index-flow-panel";
import { SiteRail } from "@/components/site-rag/site-rail";
import { useSiteSession } from "@/components/site-rag/use-site-session";

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
    clearSite,
    submitSite,
    site,
    siteBusy,
    siteError,
    siteId,
    siteUrl,
    setSiteUrl,
  } = useSiteSession({
    onConversationReset: () => {
      setMessages([]);
      clearError();
    },
  });

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!prompt.trim() || !siteId || site?.status !== "ready") {
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
          siteId,
        },
      },
    );
  }

  const ready = site?.status === "ready";
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
            <IndexFlowPanel site={site} siteError={siteError} />
          </div>

          <div className="min-h-0 md:flex md:h-full md:min-h-0">
            <SiteRail
              site={site}
              siteBusy={siteBusy}
              siteError={siteError}
              siteId={siteId}
              siteUrl={siteUrl}
              onClearSite={() => void clearSite()}
              onSubmitSite={submitSite}
              onSiteUrlChange={setSiteUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
