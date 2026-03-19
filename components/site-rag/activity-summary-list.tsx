"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkspaceActivityEvent } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

function activityTone(kind: WorkspaceActivityEvent["kind"]) {
  switch (kind) {
    case "failed-page":
      return "bg-destructive";
    case "completed":
      return "bg-primary";
    case "stored-batch":
      return "bg-primary/70";
    case "embedded-batch":
      return "bg-foreground/80";
    case "chunked-page":
      return "bg-foreground/60";
    default:
      return "bg-border";
  }
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function groupActivity(events: WorkspaceActivityEvent[]) {
  const grouped = new Map<string, WorkspaceActivityEvent>();

  for (const event of events) {
    const key = `${event.phase ?? "misc"}:${event.summaryKey ?? event.id}`;
    const previous = grouped.get(key);

    if (
      previous &&
      typeof event.progressCurrent === "number" &&
      typeof previous.progressCurrent === "number" &&
      event.progressCurrent >= previous.progressCurrent
    ) {
      grouped.set(key, event);
      continue;
    }

    if (!previous) {
      grouped.set(key, event);
    }
  }

  return [...grouped.values()].reverse();
}

type ActivitySummaryListProps = {
  events: WorkspaceActivityEvent[];
  heightClassName?: string;
};

export function ActivitySummaryList({
  events,
  heightClassName = "h-full",
}: ActivitySummaryListProps) {
  const activity = groupActivity(events);

  return (
    <div className="min-h-0 flex-1">
      <ScrollArea className={cn("min-h-0", heightClassName)}>
        <div className="flex flex-col gap-2">
          {activity.length > 0 ? (
            activity.map((event) => (
              <div
                key={`${event.summaryKey ?? event.id}-${event.id}`}
                className="grid grid-cols-[auto_1fr_auto] items-start gap-3 border p-2.5"
              >
                <span
                  className={cn(
                    "mt-1 size-2 rounded-full",
                    activityTone(event.kind),
                  )}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm font-medium">{event.detail}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {event.path ??
                      event.url ??
                      event.phase ??
                      "Workspace activity"}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  {typeof event.progressCurrent === "number" &&
                  typeof event.progressTotal === "number" ? (
                    <Badge variant="outline">
                      {event.progressCurrent}/{event.progressTotal}
                    </Badge>
                  ) : typeof event.count === "number" ? (
                    <Badge variant="outline">{event.count}</Badge>
                  ) : null}
                  <span className="text-[11px] text-muted-foreground">
                    {formatEventTime(event.at)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="border p-4 text-sm text-muted-foreground">
              Submit a site to see crawl, chunk, embed, and store progress.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
