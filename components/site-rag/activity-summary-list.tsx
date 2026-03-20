"use client";

import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import type { SiteActivityEvent } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

function activityTone(kind: SiteActivityEvent["kind"]) {
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

type ActivitySummaryListProps = {
  events: SiteActivityEvent[];
  heightClassName?: string;
};

export function ActivitySummaryList({
  events,
  heightClassName = "h-full",
}: ActivitySummaryListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickRef = useRef(true);
  const latestEventId = events.at(-1)?.id ?? "";
  const previousLatestEventRef = useRef(latestEventId);
  const previousCountRef = useRef(events.length);

  useEffect(() => {
    const viewport = scrollRef.current;
    const changed =
      previousLatestEventRef.current !== latestEventId ||
      previousCountRef.current !== events.length;

    previousLatestEventRef.current = latestEventId;
    previousCountRef.current = events.length;

    if (!viewport || !shouldStickRef.current || !changed) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [events.length, latestEventId]);

  function handleScroll() {
    const viewport = scrollRef.current;
    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    shouldStickRef.current = distanceFromBottom < 24;
  }

  return (
    <div className="min-h-0 flex-1">
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]",
          heightClassName,
        )}
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-2">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                key={event.id}
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
                    {event.path ?? event.url ?? event.phase ?? "Site activity"}
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
      </div>
    </div>
  );
}
