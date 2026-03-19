"use client";

import { useEffect, useState } from "react";

import { buildIndexPhaseVizModel } from "@/components/site-rag/index-phase-viz-data";
import type { WorkspaceManifest } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

type IndexPhaseVizProps = {
  workspace: WorkspaceManifest | null;
};

export function IndexPhaseViz({ workspace }: IndexPhaseVizProps) {
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setReducedMotion(mediaQuery.matches);
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (!workspace || workspace.status !== "indexing" || reducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % 18);
    }, 680);

    return () => {
      window.clearInterval(interval);
    };
  }, [reducedMotion, workspace]);

  const model = buildIndexPhaseVizModel(workspace, reducedMotion ? 0 : frame);

  return (
    <div className="min-h-[14rem] flex-1 md:min-h-0">
      <div
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden border",
          model.accentClassName,
        )}
      >
        <div className="min-h-0 flex-1 p-3">
          <div className="flex h-full min-h-0 flex-col overflow-hidden border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-400/80" />
                <span className="size-2 rounded-full bg-amber-300/80" />
                <span className="size-2 rounded-full bg-emerald-400/80" />
              </div>
              {model.statusLabel ? (
                <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-400">
                  {model.statusLabel}
                </span>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 font-mono text-[12px] leading-5">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="text-emerald-300">{model.prompt}</span>
                <span className="text-zinc-500">$</span>
                <span className="truncate text-zinc-100">{model.command}</span>
                <span
                  className={cn(
                    "inline-block h-4 w-2 shrink-0 bg-emerald-300 transition-opacity",
                    model.cursorVisible ? "opacity-100" : "opacity-0",
                  )}
                />
              </div>

              <div className="grid min-h-0 flex-1 auto-rows-min gap-1 overflow-hidden text-zinc-400">
                {model.outputLines.map((line, index) => (
                  <div
                    key={`${model.phase}-${line}`}
                    className={cn(
                      "truncate border-l border-transparent pl-3",
                      model.animate &&
                        index === model.activeLineIndex &&
                        "border-emerald-400/80 text-zinc-100",
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/80 px-3 py-2 text-xs">
          <span className="truncate text-muted-foreground">
            {model.caption}
          </span>
          {model.animate && !reducedMotion ? (
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              live
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
