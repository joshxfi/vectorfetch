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

type SiteIndexFormProps = {
  siteBusy: boolean;
  siteId: string | null;
  siteUrl: string;
  onClearSite: () => void;
  onSiteUrlChange: (value: string) => void;
  onSubmitSite: (event: FormEvent<HTMLFormElement>) => void;
};

export function SiteIndexForm({
  siteBusy,
  siteId,
  siteUrl,
  onClearSite,
  onSiteUrlChange,
  onSubmitSite,
}: SiteIndexFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Index Site</CardTitle>
        <CardDescription>
          One active site at a time. Submitting a new URL replaces the current
          local index.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form className="flex flex-col gap-3" onSubmit={onSubmitSite}>
          <Input
            aria-label="Website URL"
            autoComplete="off"
            disabled={siteBusy}
            placeholder="https://docs.example.com"
            value={siteUrl}
            onChange={(event) => onSiteUrlChange(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={siteBusy} type="submit">
              {siteBusy ? (
                <SpinnerGap className="animate-spin" data-icon="inline-start" />
              ) : (
                <GlobeHemisphereWest data-icon="inline-start" />
              )}
              {siteId ? "Reindex Site" : "Index Site"}
            </Button>
            <Button
              disabled={!siteId || siteBusy}
              type="button"
              variant="destructive"
              onClick={onClearSite}
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
