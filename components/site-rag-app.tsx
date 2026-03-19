"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowClockwise,
  ChatCircleDots,
  GlobeHemisphereWest,
  LinkSimple,
  MagnifyingGlass,
  SpinnerGap,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import {
  type FormEvent,
  startTransition,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { SearchChunkResult, WorkspaceManifest } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

const WORKSPACE_STORAGE_KEY = "vectorfetch:workspace-id";

type SearchToolOutput = {
  query: string;
  results: SearchChunkResult[];
};

function workspaceProgressValue(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return 0;
  }

  if (workspace.status === "ready") {
    return 100;
  }

  const total = Math.max(workspace.crawl.discovered, 1);
  const ratio = workspace.crawl.visited / total;

  return Math.max(6, Math.min(94, Math.round(ratio * 100)));
}

function workspaceTone(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return {
      label: "No site indexed",
      variant: "outline" as const,
    };
  }

  if (workspace.status === "ready") {
    return {
      label: "Ready",
      variant: "secondary" as const,
    };
  }

  if (workspace.status === "error") {
    return {
      label: "Needs attention",
      variant: "destructive" as const,
    };
  }

  return {
    label: "Indexing",
    variant: "outline" as const,
  };
}

function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function messageSearchOutputs(message: UIMessage) {
  return message.parts.flatMap((part) => {
    if (
      part.type !== "tool-searchSiteContext" ||
      part.state !== "output-available"
    ) {
      return [];
    }

    return [part.output as SearchToolOutput];
  });
}

function messageSources(message: UIMessage) {
  const seen = new Set<string>();
  const sources: SearchChunkResult[] = [];

  for (const output of messageSearchOutputs(message)) {
    for (const result of output.results) {
      if (seen.has(result.url)) {
        continue;
      }

      seen.add(result.url);
      sources.push(result);
    }
  }

  return sources;
}

function statusLine(workspace: WorkspaceManifest | null) {
  if (!workspace) {
    return "Submit a root URL to start crawling and indexing a site.";
  }

  if (workspace.status === "ready") {
    return `${workspace.stats.pageCount} pages indexed across ${workspace.stats.chunkCount} chunks.`;
  }

  if (workspace.status === "error") {
    return workspace.error ?? "Indexing failed.";
  }

  return `Visited ${workspace.crawl.visited}/${Math.max(
    workspace.crawl.discovered,
    1,
  )} discovered pages.`;
}

export function SiteRagApp() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceManifest | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [prompt, setPrompt] = useState("");
  const tone = workspaceTone(workspace);

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
    }, 1500);

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

  return (
    <div className="min-h-svh bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-primary/10 via-transparent to-transparent" />
      <div className="relative mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <header className="flex flex-col gap-2 border-b pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Local Website RAG</Badge>
            <Badge variant={tone.variant}>{tone.label}</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-medium tracking-tight">VectorFetch</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Crawl one website locally, index it with Ollama embeddings, and
              let the assistant retrieve site chunks during chat.
            </p>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Site Workspace</CardTitle>
                <CardDescription>
                  One same-origin site per workspace. Submitting a new URL
                  replaces the current local index.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <form
                  className="flex flex-col gap-3"
                  onSubmit={submitWorkspace}
                >
                  <Input
                    aria-label="Website URL"
                    autoComplete="off"
                    disabled={workspaceBusy}
                    placeholder="https://docs.example.com"
                    value={workspaceUrl}
                    onChange={(event) => setWorkspaceUrl(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button disabled={workspaceBusy} type="submit">
                      {workspaceBusy ? (
                        <SpinnerGap
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                      ) : (
                        <GlobeHemisphereWest data-icon="inline-start" />
                      )}
                      {workspaceId ? "Reindex Site" : "Index Site"}
                    </Button>
                    <Button
                      disabled={!workspaceId || workspaceBusy}
                      type="button"
                      variant="destructive"
                      onClick={() => void clearWorkspace()}
                    >
                      <Trash data-icon="inline-start" />
                      Clear
                    </Button>
                  </div>
                </form>

                {workspaceError ? (
                  <Alert variant="destructive">
                    <Warning />
                    <AlertTitle>Workspace Error</AlertTitle>
                    <AlertDescription>{workspaceError}</AlertDescription>
                  </Alert>
                ) : null}

                <Separator />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium">
                        Index progress
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {statusLine(workspace)}
                      </span>
                    </div>
                    {workspace?.status === "indexing" ? (
                      <SpinnerGap className="animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                  <Progress value={workspaceProgressValue(workspace)}>
                    <ProgressLabel>Website indexing</ProgressLabel>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {workspaceProgressValue(workspace)}%
                    </span>
                  </Progress>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-2 text-xs text-muted-foreground">
                <span>
                  Models:{" "}
                  <span className="text-foreground">qwen3-embedding:0.6b</span>{" "}
                  for embeddings and{" "}
                  <span className="text-foreground">lfm2:24b</span> for chat.
                </span>
                <span>
                  Storage stays local in a temporary workspace until you clear
                  it.
                </span>
              </CardFooter>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Workspace Stats</CardTitle>
                <CardDescription>
                  Current crawl and indexing state for the active site.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1 border p-3">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Pages
                    </span>
                    <span className="text-lg font-medium tabular-nums">
                      {workspace?.stats.pageCount ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 border p-3">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Chunks
                    </span>
                    <span className="text-lg font-medium tabular-nums">
                      {workspace?.stats.chunkCount ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 border p-3">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Discovered
                    </span>
                    <span className="text-lg font-medium tabular-nums">
                      {workspace?.crawl.discovered ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 border p-3">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Failed
                    </span>
                    <span className="text-lg font-medium tabular-nums">
                      {workspace?.crawl.failed ?? 0}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Active root URL</span>
                  <span className="break-all text-xs text-muted-foreground">
                    {workspace?.rootUrl ?? "No active workspace"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-[70svh]">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Site Chat</CardTitle>
                  <CardDescription>
                    Ask questions against the indexed site. The assistant
                    retrieves relevant chunks during each answer.
                  </CardDescription>
                </div>
                <Badge variant={ready ? "secondary" : "outline"}>
                  {ready ? "Retrieval on" : "Waiting for index"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              {chatError ? (
                <Alert variant="destructive">
                  <Warning />
                  <AlertTitle>Chat Error</AlertTitle>
                  <AlertDescription>{chatError.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden border">
                <ScrollArea className="h-[52svh] lg:h-[62svh]">
                  <div className="flex flex-col gap-4 p-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-3 border p-4">
                          <ChatCircleDots className="mt-0.5 text-muted-foreground" />
                          <div className="flex flex-col gap-2">
                            <p className="text-sm font-medium">
                              Ask about the indexed website
                            </p>
                            <p className="text-sm text-muted-foreground">
                              The assistant will search the local vector index
                              before answering and will cite the pages it used.
                            </p>
                          </div>
                        </div>

                        {!ready ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <Skeleton className="h-24 border" />
                            <Skeleton className="h-24 border" />
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {messages.map((message) => {
                      const text = messageText(message);
                      const sources =
                        message.role === "assistant"
                          ? messageSources(message)
                          : [];

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex flex-col gap-3",
                            message.role === "user"
                              ? "items-end"
                              : "items-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-3xl border px-4 py-3 text-sm whitespace-pre-wrap",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-card-foreground",
                            )}
                          >
                            {text || (
                              <span className="text-muted-foreground">
                                Waiting for model output...
                              </span>
                            )}
                          </div>

                          {message.role === "assistant" &&
                          sources.length > 0 ? (
                            <div className="flex w-full max-w-3xl flex-col gap-2 border p-3">
                              <div className="flex items-center gap-2 text-xs font-medium">
                                <MagnifyingGlass className="text-muted-foreground" />
                                Retrieved sources
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {sources.map((source) => (
                                  <a
                                    key={source.url}
                                    className="flex flex-col gap-1 border p-3 transition-colors hover:bg-muted"
                                    href={source.url}
                                    rel="noreferrer"
                                    target="_blank"
                                  >
                                    <span className="line-clamp-1 text-sm font-medium">
                                      {source.title}
                                    </span>
                                    <span className="line-clamp-1 text-xs text-muted-foreground">
                                      {source.url}
                                    </span>
                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                      {source.text}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {chatStatus === "submitted" ||
                    chatStatus === "streaming" ? (
                      <div className="flex max-w-3xl flex-col gap-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <SpinnerGap className="animate-spin" />
                          Retrieving site context and generating an answer
                        </div>
                        <Skeleton className="h-16 border" />
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t">
              {!ready ? (
                <Alert>
                  <LinkSimple />
                  <AlertTitle>Index a site first</AlertTitle>
                  <AlertDescription>
                    Chat is enabled after the workspace finishes crawling and
                    embedding.
                  </AlertDescription>
                </Alert>
              ) : null}

              <form
                className="flex w-full flex-col gap-3"
                onSubmit={submitPrompt}
              >
                <Textarea
                  disabled={
                    !ready ||
                    chatStatus === "submitted" ||
                    chatStatus === "streaming"
                  }
                  placeholder={
                    ready
                      ? "Ask about the indexed site..."
                      : "Waiting for the local index to finish..."
                  }
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {ready
                      ? "The first chat step forces a retrieval tool call against the local vector index."
                      : "The assistant stays disabled until the site is ready."}
                  </span>
                  <Button
                    disabled={
                      !ready ||
                      !prompt.trim() ||
                      chatStatus === "submitted" ||
                      chatStatus === "streaming"
                    }
                    type="submit"
                  >
                    {chatStatus === "submitted" ||
                    chatStatus === "streaming" ? (
                      <SpinnerGap
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <ArrowClockwise data-icon="inline-start" />
                    )}
                    Ask Site
                  </Button>
                </div>
              </form>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
