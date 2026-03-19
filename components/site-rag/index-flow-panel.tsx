"use client";

import { Database, SpinnerGap, Warning } from "@phosphor-icons/react";

import {
  statusLine,
  workspaceProgressValue,
  workspaceTone,
} from "@/components/site-rag/helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import type { WorkspaceManifest, WorkspacePhase } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

const pipelineSteps: {
  phase: Exclude<WorkspacePhase, "ready" | "error">;
  label: string;
  description: string;
  value: (workspace: WorkspaceManifest | null) => string;
}[] = [
  {
    phase: "crawling",
    label: "Crawl",
    description: "Discover and fetch same-origin pages.",
    value: (workspace) =>
      `${workspace?.pipeline.visitedPages ?? 0}/${workspace?.pipeline.discoveredPages ?? 0}`,
  },
  {
    phase: "chunking",
    label: "Chunk",
    description: "Split scraped pages into retrievable blocks.",
    value: (workspace) =>
      `${workspace?.pipeline.chunkedPages ?? 0}/${workspace?.stats.pageCount ?? 0}`,
  },
  {
    phase: "embedding",
    label: "Embed",
    description: "Generate local vectors with the embedding model.",
    value: (workspace) =>
      `${workspace?.pipeline.embeddedChunks ?? 0}/${workspace?.stats.chunkCount ?? 0}`,
  },
  {
    phase: "storing",
    label: "Store",
    description: "Write chunks into the in-process zvec collection.",
    value: (workspace) =>
      `${workspace?.pipeline.storedChunks ?? 0}/${workspace?.stats.chunkCount ?? 0}`,
  },
];

function phaseIndex(phase: WorkspacePhase) {
  if (phase === "ready") {
    return pipelineSteps.length;
  }

  if (phase === "error") {
    return -1;
  }

  return pipelineSteps.findIndex((step) => step.phase === phase);
}

type IndexFlowPanelProps = {
  workspace: WorkspaceManifest | null;
  workspaceError: string | null;
};

export function IndexFlowPanel({
  workspace,
  workspaceError,
}: IndexFlowPanelProps) {
  const tone = workspaceTone(workspace);
  const activeIndex = workspace ? phaseIndex(workspace.phase) : -1;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Index Flow</CardTitle>
          <Badge variant={tone.variant}>{tone.label}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {statusLine(workspace)}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
        {workspaceError ? (
          <Alert variant="destructive">
            <Warning />
            <AlertTitle>Workspace Error</AlertTitle>
            <AlertDescription>{workspaceError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium">Pipeline progress</span>
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

        <div className="grid shrink-0 gap-2 md:grid-cols-2">
          {pipelineSteps.map((step, index) => {
            const complete =
              workspace?.status === "ready" ||
              (workspace && activeIndex > index);
            const active =
              workspace?.status === "indexing" && activeIndex === index;

            return (
              <div
                key={step.phase}
                className={cn(
                  "grid gap-2 border p-2.5",
                  complete && "bg-primary/5",
                  active && "ring-1 ring-foreground/20",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full bg-border",
                        complete && "bg-primary",
                        active && "bg-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">{step.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {step.value(workspace)}
                  </span>
                </div>
                <div className="line-clamp-1 text-[11px] text-muted-foreground">
                  {step.description}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 border p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Pages</span>
            <span className="font-medium tabular-nums">
              {workspace?.stats.pageCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Chunks</span>
            <span className="font-medium tabular-nums">
              {workspace?.stats.chunkCount ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Discovered</span>
            <span className="font-medium tabular-nums">
              {workspace?.pipeline.discoveredPages ?? 0}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Failed</span>
            <span className="font-medium tabular-nums">
              {workspace?.pipeline.failedPages ?? 0}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate">
            {workspace?.rootUrl ?? "No active workspace"}
          </span>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Database />
            zvec local store
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
