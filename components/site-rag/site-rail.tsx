"use client";

import type { FormEvent } from "react";

import { ActivitySummaryList } from "@/components/site-rag/activity-summary-list";
import { siteTone } from "@/components/site-rag/helpers";
import { SiteIndexForm } from "@/components/site-rag/site-index-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHAT_MODEL, EMBEDDING_MODEL } from "@/lib/rag/constants";
import type { SiteSessionManifest } from "@/lib/rag/types";

type SiteRailProps = {
  site: SiteSessionManifest | null;
  siteBusy: boolean;
  siteError: string | null;
  siteId: string | null;
  siteUrl: string;
  onClearSite: () => void;
  onSiteUrlChange: (value: string) => void;
  onSubmitSite: (event: FormEvent<HTMLFormElement>) => void;
};

export function SiteRail({
  site,
  siteBusy,
  siteError,
  siteId,
  siteUrl,
  onClearSite,
  onSiteUrlChange,
  onSubmitSite,
}: SiteRailProps) {
  const tone = siteTone(site);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <SiteIndexForm
          siteBusy={siteBusy}
          siteId={siteId}
          siteUrl={siteUrl}
          onClearSite={onClearSite}
          onSiteUrlChange={onSiteUrlChange}
          onSubmitSite={onSubmitSite}
        />
      </div>

      {siteError ? (
        <div className="shrink-0 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {siteError}
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
              {site?.rootUrl ?? "No active site"}
            </span>
            <span>
              Models: {site?.embeddingModel ?? EMBEDDING_MODEL} /{" "}
              {site?.chatModel ?? CHAT_MODEL}
            </span>
          </div>

          <ActivitySummaryList
            events={site?.recentActivity ?? []}
            heightClassName="h-full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
