"use client";

import { GlobeHemisphereWest, SpinnerGap, Trash } from "@phosphor-icons/react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type WorkspaceFormProps = {
  workspaceBusy: boolean;
  workspaceId: string | null;
  workspaceUrl: string;
  onClearWorkspace: () => void;
  onSubmitWorkspace: (event: FormEvent<HTMLFormElement>) => void;
  onWorkspaceUrlChange: (value: string) => void;
};

export function WorkspaceForm({
  workspaceBusy,
  workspaceId,
  workspaceUrl,
  onClearWorkspace,
  onSubmitWorkspace,
  onWorkspaceUrlChange,
}: WorkspaceFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Index Site</CardTitle>
        <CardDescription>
          One same-origin site per workspace. Submitting a new URL replaces the
          current local index.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form className="flex flex-col gap-3" onSubmit={onSubmitWorkspace}>
          <Input
            aria-label="Website URL"
            autoComplete="off"
            disabled={workspaceBusy}
            placeholder="https://docs.example.com"
            value={workspaceUrl}
            onChange={(event) => onWorkspaceUrlChange(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={workspaceBusy} type="submit">
              {workspaceBusy ? (
                <SpinnerGap className="animate-spin" data-icon="inline-start" />
              ) : (
                <GlobeHemisphereWest data-icon="inline-start" />
              )}
              {workspaceId ? "Reindex Site" : "Index Site"}
            </Button>
            <Button
              disabled={!workspaceId || workspaceBusy}
              type="button"
              variant="destructive"
              onClick={onClearWorkspace}
            >
              <Trash data-icon="inline-start" />
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
