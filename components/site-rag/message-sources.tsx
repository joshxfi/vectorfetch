import type { SearchChunkResult } from "@/lib/rag/types";

type MessageSourcesProps = {
  sources: SearchChunkResult[];
};

export function MessageSources({ sources }: MessageSourcesProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-2 border p-3">
      <div className="text-xs font-medium">Retrieved Sources</div>
      <div className="grid gap-2 xl:grid-cols-2">
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
  );
}
