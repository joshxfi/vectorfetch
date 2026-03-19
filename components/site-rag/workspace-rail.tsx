"use client";

import type { FormEvent } from "react";

import { ActivitySummaryList } from "@/components/site-rag/activity-summary-list";
import { workspaceTone } from "@/components/site-rag/helpers";
import { WorkspaceForm } from "@/components/site-rag/workspace-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceManifest } from "@/lib/rag/types";

type WorkspaceRailProps = {
  workspace: WorkspaceManifest | null;
  workspaceBusy: boolean;
  workspaceError: string | null;
  workspaceId: string | null;
  workspaceUrl: string;
  onClearWorkspace: () => void;
  onSubmitWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  onWorkspaceUrlChange: (value: string) => void;
};

export function WorkspaceRail({
  workspace,
  workspaceBusy,
  workspaceError,
  workspaceId,
  workspaceUrl,
  onClearWorkspace,
  onSubmitWorkspace,
  onWorkspaceUrlChange,
}: WorkspaceRailProps) {
  const tone = workspaceTone(workspace);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <WorkspaceForm
          workspaceBusy={workspaceBusy}
          workspaceId={workspaceId}
          workspaceUrl={workspaceUrl}
          onClearWorkspace={onClearWorkspace}
          onSubmitWorkspace={onSubmitWorkspace}
          onWorkspaceUrlChange={onWorkspaceUrlChange}
        />
      </div>

      {workspaceError ? (
        <div className="shrink-0 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {workspaceError}
        </div>
      ) : null}

      <Card size="sm" className="min-h-0 flex-1">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent Summaries</CardTitle>
            <Badge variant={tone.variant}>{tone.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pt-3">
          <div className="grid gap-1 border p-2 text-xs text-muted-foreground">
            <span className="break-all">
              {workspace?.rootUrl ?? "No active workspace"}
            </span>
            <span>
              Models: {workspace?.embeddingModel ?? "qwen3-embedding:0.6b"} /{" "}
              {workspace?.chatModel ?? "lfm2:24b"}
            </span>
          </div>

          <ActivitySummaryList
            events={workspace?.recentActivity ?? []}
            heightClassName="h-full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
