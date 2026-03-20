export const DEFAULT_CHAT_MODEL = "lfm2:24b";
export const DEFAULT_EMBEDDING_MODEL = "qwen3-embedding:0.6b";
export const DEFAULT_CRAWL_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
export const DEFAULT_CRAWL_MAX_CONCURRENCY = 4;
export const DEFAULT_CRAWL_DELAY_MS = 750;
export const DEFAULT_ZVEC_INSERT_BATCH_SIZE = 200;

export function envOrDefault(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export function envNumberOrDefault(
  value: string | undefined,
  fallback: number,
) {
  const normalized = Number(value?.trim());

  if (!Number.isFinite(normalized) || normalized < 0) {
    return fallback;
  }

  return normalized;
}

export const CHAT_MODEL = envOrDefault(
  process.env.VECTORFETCH_CHAT_MODEL,
  DEFAULT_CHAT_MODEL,
);
export const EMBEDDING_MODEL = envOrDefault(
  process.env.VECTORFETCH_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_MODEL,
);
export const CRAWL_USER_AGENT = envOrDefault(
  process.env.VECTORFETCH_CRAWL_USER_AGENT,
  DEFAULT_CRAWL_USER_AGENT,
);
export const CRAWL_MAX_CONCURRENCY = Math.max(
  1,
  Math.floor(
    envNumberOrDefault(
      process.env.VECTORFETCH_CRAWL_MAX_CONCURRENCY,
      DEFAULT_CRAWL_MAX_CONCURRENCY,
    ),
  ),
);
export const CRAWL_DELAY_MS = envNumberOrDefault(
  process.env.VECTORFETCH_CRAWL_DELAY_MS,
  DEFAULT_CRAWL_DELAY_MS,
);
export const CRAWL_BROWSER_FALLBACK_ENABLED =
  process.env.VECTORFETCH_CRAWL_BROWSER_FALLBACK === "true";
export const ZVEC_INSERT_BATCH_SIZE = Math.max(
  1,
  Math.floor(
    envNumberOrDefault(
      process.env.VECTORFETCH_ZVEC_INSERT_BATCH_SIZE,
      DEFAULT_ZVEC_INSERT_BATCH_SIZE,
    ),
  ),
);

export const WORKSPACE_STORAGE_DIRNAME = "vectorfetch-workspaces";
export const MANIFEST_FILENAME = "manifest.json";
export const COLLECTION_DIRNAME = "collection";

export const MAX_CRAWL_PAGES = 50;
export const MIN_PAGE_TEXT_LENGTH = 160;
export const CHUNK_MAX_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 200;
export const SEARCH_RESULT_LIMIT = 6;
export const MAX_TOOL_SEARCH_RESULTS = 12;
