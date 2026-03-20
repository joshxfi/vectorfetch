export const DEFAULT_CHAT_MODEL = "lfm2:24b";
export const DEFAULT_EMBEDDING_MODEL = "qwen3-embedding:0.6b";

function envOrDefault(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export const CHAT_MODEL = envOrDefault(
  process.env.VECTORFETCH_CHAT_MODEL,
  DEFAULT_CHAT_MODEL,
);
export const EMBEDDING_MODEL = envOrDefault(
  process.env.VECTORFETCH_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_MODEL,
);

export const WORKSPACE_STORAGE_DIRNAME = "vectorfetch-workspaces";
export const MANIFEST_FILENAME = "manifest.json";
export const COLLECTION_DIRNAME = "collection";

export const MAX_CRAWL_PAGES = 200;
export const MIN_PAGE_TEXT_LENGTH = 160;
export const CHUNK_MAX_CHARS = 1200;
export const CHUNK_OVERLAP_CHARS = 200;
export const SEARCH_RESULT_LIMIT = 6;
export const MAX_TOOL_SEARCH_RESULTS = 12;
