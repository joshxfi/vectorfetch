"use client";

import { ArrowClockwise, LinkSimple, SpinnerGap } from "@phosphor-icons/react";
import type { FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PromptComposerProps = {
  busyChat: boolean;
  prompt: string;
  ready: boolean;
  onPromptChange: (value: string) => void;
  onSubmitPrompt: (event: FormEvent<HTMLFormElement>) => void;
};

export function PromptComposer({
  busyChat,
  prompt,
  ready,
  onPromptChange,
  onSubmitPrompt,
}: PromptComposerProps) {
  return (
    <div className="flex flex-col gap-4">
      {!ready ? (
        <Alert>
          <LinkSimple />
          <AlertTitle>Index a site first</AlertTitle>
          <AlertDescription>
            Chat is enabled after the workspace finishes crawling and embedding.
          </AlertDescription>
        </Alert>
      ) : null}

      <form className="flex w-full flex-col gap-3" onSubmit={onSubmitPrompt}>
        <Textarea
          disabled={!ready || busyChat}
          placeholder={
            ready
              ? "Ask about the indexed site..."
              : "Waiting for the local index to finish..."
          }
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Retrieval runs against the local zvec index before answering.
          </span>
          <Button disabled={!ready || !prompt.trim() || busyChat} type="submit">
            {busyChat ? (
              <SpinnerGap className="animate-spin" data-icon="inline-start" />
            ) : (
              <ArrowClockwise data-icon="inline-start" />
            )}
            Ask Site
          </Button>
        </div>
      </form>
    </div>
  );
}
