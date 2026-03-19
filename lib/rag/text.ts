import { createHash } from "node:crypto";

import type { CheerioCrawlingContext } from "crawlee";

import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  MIN_PAGE_TEXT_LENGTH,
} from "@/lib/rag/constants";
import type { ChunkRecord, CrawledPage } from "@/lib/rag/types";
import { urlPathname } from "@/lib/rag/url";

const BLOCK_SELECTORS =
  "h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,td,th,code,figcaption";
const NOISE_SELECTORS =
  "script,style,noscript,iframe,svg,canvas,nav,footer,header,aside,form,button,[aria-hidden='true']";

function normalizeWhitespace(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromUrl(url: string) {
  const { pathname } = new URL(url);
  if (pathname === "/" || pathname === "") {
    return new URL(url).hostname;
  }

  return pathname.split("/").filter(Boolean).slice(-1)[0].replace(/[-_]/g, " ");
}

function splitLongBlock(text: string, maxChars: number, overlapChars: number) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const slice = text.slice(cursor, cursor + maxChars).trim();
    if (!slice) {
      break;
    }

    chunks.push(slice);

    if (cursor + maxChars >= text.length) {
      break;
    }

    cursor += maxChars - overlapChars;
  }

  return chunks;
}

function overlapTail(text: string, overlapChars: number) {
  if (text.length <= overlapChars) {
    return text;
  }

  return text.slice(text.length - overlapChars).trim();
}

export function extractPageContent({
  $,
  url,
}: {
  $: CheerioCrawlingContext["$"];
  url: string;
}): CrawledPage | null {
  const preferredRoot = $("main, article").first();
  const sourceRoot =
    preferredRoot.length > 0 ? preferredRoot : $("body").first();

  if (sourceRoot.length === 0) {
    return null;
  }

  const root = sourceRoot.clone();
  root.find(NOISE_SELECTORS).remove();

  const blocks = root
    .find(BLOCK_SELECTORS)
    .toArray()
    .map((node) => {
      const element = $(node);
      const text = normalizeWhitespace(element.text());

      if (!text) {
        return null;
      }

      const tagName = node.tagName?.toLowerCase() ?? "";
      if (/^h[1-6]$/.test(tagName)) {
        return `${"#".repeat(Number(tagName[1]))} ${text}`;
      }

      return text;
    })
    .filter((block): block is string => block !== null);

  if (blocks.length === 0) {
    const bodyText = normalizeWhitespace(root.text());
    if (bodyText.length < MIN_PAGE_TEXT_LENGTH) {
      return null;
    }

    blocks.push(bodyText);
  }

  const text = blocks.join("\n\n").trim();
  if (text.length < MIN_PAGE_TEXT_LENGTH) {
    return null;
  }

  const title =
    normalizeWhitespace($("title").first().text()) ||
    normalizeWhitespace(root.find("h1").first().text()) ||
    titleFromUrl(url);

  return {
    url,
    path: urlPathname(url),
    title,
    text,
    contentHash: createHash("sha1").update(text).digest("hex"),
  };
}

export function chunkPages(
  pages: CrawledPage[],
  {
    maxChars = CHUNK_MAX_CHARS,
    overlapChars = CHUNK_OVERLAP_CHARS,
  }: {
    maxChars?: number;
    overlapChars?: number;
  } = {},
) {
  const chunks: ChunkRecord[] = [];

  for (const [pageIndex, page] of pages.entries()) {
    const blocks = page.text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    const pageChunks: string[] = [];
    let current = "";

    const flush = () => {
      const value = current.trim();
      if (value) {
        pageChunks.push(value);
      }
      current = "";
    };

    for (const block of blocks) {
      if (block.length > maxChars) {
        flush();
        const oversizedPieces = splitLongBlock(block, maxChars, overlapChars);
        pageChunks.push(...oversizedPieces);
        continue;
      }

      const candidate = current ? `${current}\n\n${block}` : block;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }

      const tail = overlapTail(current, overlapChars);
      flush();
      current = tail ? `${tail}\n\n${block}` : block;
    }

    flush();

    for (const [chunkIndex, text] of pageChunks.entries()) {
      chunks.push({
        id: `${pageIndex}-${chunkIndex}`,
        url: page.url,
        path: page.path,
        title: page.title,
        text,
        chunkIndex,
        pageIndex,
      });
    }
  }

  return chunks;
}
