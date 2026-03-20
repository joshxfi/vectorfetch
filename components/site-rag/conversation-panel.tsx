"use client";

import {
  ChatCircleDots,
  MagnifyingGlass,
  SpinnerGap,
  Warning,
} from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { type FormEvent, useEffect, useMemo, useRef } from "react";
import { Streamdown } from "streamdown";

import { messageSources, messageText } from "@/components/site-rag/helpers";
import { MessageSources } from "@/components/site-rag/message-sources";
import { PromptComposer } from "@/components/site-rag/prompt-composer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ConversationPanelProps = {
  busyChat: boolean;
  chatError?: Error;
  isIndexing: boolean;
  messages: UIMessage[];
  prompt: string;
  ready: boolean;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: (event: FormEvent<HTMLFormElement>) => void;
};

function EmptyConversationState({ isIndexing }: { isIndexing: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 border p-4 md:grid-cols-[auto_1fr]">
        <ChatCircleDots className="text-muted-foreground" />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            Ask the site once the local index is ready
          </p>
          <p className="text-sm text-muted-foreground">
            The assistant searches your local zvec collection before answering
            and cites the pages it used.
          </p>
        </div>
      </div>

      {isIndexing ? (
        <div className="flex flex-col gap-3">
          <div className="flex w-full items-start">
            <div className="flex w-full flex-col gap-3 border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <SpinnerGap className="animate-spin shrink-0" />
                <span>Waiting for a site to finish indexing</span>
              </div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          <div className="flex w-full justify-end">
            <div className="flex w-full max-w-3xl flex-col gap-3 border border-dashed p-4">
              <Skeleton className="h-4 w-36 self-end" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3 self-end" />
            </div>
          </div>

          <div className="flex w-full items-start">
            <div className="flex w-full flex-col gap-3 border p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed p-4 text-sm text-muted-foreground">
          No active site yet. Paste a root URL on the right to build a local
          index, then start the conversation here.
        </div>
      )}
    </div>
  );
}

export function ConversationPanel({
  busyChat,
  chatError,
  isIndexing,
  messages,
  prompt,
  ready,
  onPromptChange,
  onSubmitPrompt,
}: ConversationPanelProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const shouldStickRef = useRef(true);
  const previousSignatureRef = useRef("");
  const lastMessage = messages.at(-1);
  const showPendingResponseLoader =
    busyChat && lastMessage?.role !== "assistant";
  const lastMessageSignature = useMemo(() => {
    const latestMessage = messages.at(-1);
    if (!latestMessage) {
      return "empty";
    }

    return `${latestMessage.id}:${messageText(latestMessage).length}:${messages.length}`;
  }, [messages]);

  useEffect(() => {
    const viewport = contentRef.current?.parentElement;
    if (!viewport) {
      return;
    }

    const updateStickiness = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickRef.current = distanceFromBottom < 32;
    };

    updateStickiness();
    viewport.addEventListener("scroll", updateStickiness, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", updateStickiness);
    };
  }, []);

  useEffect(() => {
    const viewport = contentRef.current?.parentElement;
    const changed = previousSignatureRef.current !== lastMessageSignature;
    previousSignatureRef.current = lastMessageSignature;

    if (!changed) {
      return;
    }

    if (!viewport || !shouldStickRef.current) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [lastMessageSignature]);

  return (
    <Card className="flex h-full w-full min-h-0 flex-col">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Conversation</CardTitle>
            <CardDescription>
              Ask about the active site and inspect the retrieved sources tied
              to each answer.
            </CardDescription>
          </div>
          <Badge variant={ready ? "secondary" : "outline"}>
            {ready ? "Retrieval on" : "Waiting for site"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {chatError ? (
          <div className="border-b p-4">
            <Alert variant="destructive">
              <Warning />
              <AlertTitle>Chat Error</AlertTitle>
              <AlertDescription>{chatError.message}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <div ref={contentRef} className="flex min-h-full flex-col gap-4 p-4">
            {messages.length === 0 ? (
              <EmptyConversationState isIndexing={isIndexing} />
            ) : null}

            {messages.map((message) => {
              const text = messageText(message);
              const sources =
                message.role === "assistant" ? messageSources(message) : [];
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex w-full flex-col gap-3",
                    isUser ? "items-end" : "items-stretch",
                  )}
                >
                  <div
                    className={cn(
                      "w-full border px-4 py-3 text-sm whitespace-pre-wrap",
                      isUser && "max-w-3xl",
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-card-foreground",
                    )}
                  >
                    {text ? (
                      isUser ? (
                        text
                      ) : (
                        <Streamdown
                          className="streamdown prose prose-neutral max-w-none text-current dark:prose-invert"
                          isAnimating={busyChat}
                          mode={busyChat ? "streaming" : "static"}
                        >
                          {text}
                        </Streamdown>
                      )
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <SpinnerGap className="animate-spin shrink-0" />
                          <span>Generating response</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-2/3" />
                        </div>
                      </div>
                    )}
                  </div>

                  {!isUser && sources.length > 0 ? (
                    <div className="flex w-full flex-col gap-2">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <MagnifyingGlass className="text-muted-foreground" />
                        Retrieved sources
                      </div>
                      <MessageSources sources={sources} />
                    </div>
                  ) : null}
                </div>
              );
            })}

            {showPendingResponseLoader ? (
              <div className="flex w-full flex-col gap-3 items-stretch">
                <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                  <SpinnerGap className="animate-spin shrink-0" />
                  <span className="truncate">
                    Retrieving site context and generating an answer
                  </span>
                </div>
                <div className="flex w-full flex-col gap-3 border px-4 py-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t p-0">
        <div className="w-full p-4">
          <PromptComposer
            busyChat={busyChat}
            prompt={prompt}
            ready={ready}
            onPromptChange={onPromptChange}
            onSubmitPrompt={onSubmitPrompt}
          />
        </div>
      </CardFooter>
    </Card>
  );
}
