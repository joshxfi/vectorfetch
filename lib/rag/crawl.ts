import {
  CheerioCrawler,
  type CheerioCrawlingContext,
  Configuration,
} from "@crawlee/cheerio";

import {
  CRAWL_DELAY_MS,
  CRAWL_MAX_CONCURRENCY,
  CRAWL_USER_AGENT,
  MAX_CRAWL_PAGES,
} from "@/lib/rag/constants";
import { extractPageContent } from "@/lib/rag/text";
import type {
  CrawledPage,
  CrawlFailure,
  WorkspaceProgress,
} from "@/lib/rag/types";
import { isSameOriginUrl, normalizeCrawlUrl, urlPathname } from "@/lib/rag/url";

const BLOCKED_STATUS_CODES = new Set([403, 429]);
const ADAPTIVE_DELAY_RECOVERY_WINDOW = 3;

type AdaptiveThrottleState = {
  blockedFailures: number;
  currentDelayMs: number;
  successesSinceBlock: number;
};

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function createCrawlHeaders(referer?: string) {
  const headers: Record<string, string> = {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": referer ? "same-origin" : "none",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": CRAWL_USER_AGENT,
  };

  if (referer) {
    headers.Referer = referer;
  }

  return headers;
}

function createCrawlRequest(url: string, referer?: string) {
  return {
    url,
    headers: createCrawlHeaders(referer),
  };
}

function extractStatusCode(message: string) {
  const match = message.match(
    /\b(401|403|404|408|409|410|429|500|502|503|504)\b/,
  );
  return match ? Number(match[1]) : null;
}

export function describeCrawlFailure(input: {
  url: string;
  path: string;
  errorMessage?: string | null;
  statusCode?: number | null;
}): CrawlFailure {
  const statusCode =
    input.statusCode ?? extractStatusCode(input.errorMessage ?? "");
  const blocked = statusCode !== null && BLOCKED_STATUS_CODES.has(statusCode);
  const message = blocked
    ? `Blocked while crawling ${input.path}${statusCode ? ` (${statusCode})` : ""}. The site may be rejecting crawler requests.`
    : statusCode
      ? `Failed to crawl ${input.path} (${statusCode}).`
      : `Failed to crawl ${input.path}.`;

  return {
    url: input.url,
    path: input.path,
    statusCode,
    blocked,
    message,
  };
}

export function getAdaptiveCrawlDelayMs(
  blockedFailures: number,
  baseDelayMs: number,
) {
  if (blockedFailures <= 0 || baseDelayMs <= 0) {
    return 0;
  }

  return Math.min(baseDelayMs * blockedFailures, baseDelayMs * 4);
}

function noteSuccessfulRequest(throttle: AdaptiveThrottleState) {
  if (throttle.blockedFailures <= 0) {
    throttle.currentDelayMs = 0;
    return;
  }

  throttle.successesSinceBlock += 1;

  if (throttle.successesSinceBlock < ADAPTIVE_DELAY_RECOVERY_WINDOW) {
    return;
  }

  throttle.blockedFailures = Math.max(0, throttle.blockedFailures - 1);
  throttle.successesSinceBlock = 0;
  throttle.currentDelayMs = getAdaptiveCrawlDelayMs(
    throttle.blockedFailures,
    CRAWL_DELAY_MS,
  );
}

function noteBlockedRequest(throttle: AdaptiveThrottleState) {
  throttle.blockedFailures += 1;
  throttle.successesSinceBlock = 0;
  throttle.currentDelayMs = getAdaptiveCrawlDelayMs(
    throttle.blockedFailures,
    CRAWL_DELAY_MS,
  );
}

export function collectCrawlTargets({
  hrefs,
  currentUrl,
  origin,
  seenUrls,
  limit,
}: {
  hrefs: string[];
  currentUrl: string;
  origin: string;
  seenUrls: Set<string>;
  limit: number;
}) {
  const urls: string[] = [];

  for (const href of hrefs) {
    if (!href || seenUrls.size >= limit) {
      continue;
    }

    const normalized = normalizeCrawlUrl(href, currentUrl);
    if (!normalized || !isSameOriginUrl(normalized, origin)) {
      continue;
    }

    if (seenUrls.has(normalized)) {
      continue;
    }

    seenUrls.add(normalized);
    urls.push(normalized);
  }

  return urls;
}

function uniqueLinks({
  $,
  currentUrl,
  origin,
  seenUrls,
  limit,
}: {
  $: CheerioCrawlingContext["$"];
  currentUrl: string;
  origin: string;
  seenUrls: Set<string>;
  limit: number;
}) {
  const hrefs: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href) {
      hrefs.push(href);
    }
  });

  return collectCrawlTargets({
    hrefs,
    currentUrl,
    origin,
    seenUrls,
    limit,
  });
}

export async function crawlSite({
  rootUrl,
  maxPages = MAX_CRAWL_PAGES,
  onProgress,
  onDiscovered,
  onPageIndexed,
  onFailedPage,
}: {
  rootUrl: string;
  maxPages?: number;
  onProgress?: (progress: WorkspaceProgress) => Promise<void> | void;
  onDiscovered?: (urls: string[]) => Promise<void> | void;
  onPageIndexed?: (
    page: CrawledPage,
    progress: WorkspaceProgress,
  ) => Promise<void> | void;
  onFailedPage?: (
    page: CrawlFailure,
    progress: WorkspaceProgress,
  ) => Promise<void> | void;
}) {
  const progress: WorkspaceProgress = {
    discovered: 1,
    visited: 0,
    indexedPages: 0,
    skipped: 0,
    failed: 0,
    limit: maxPages,
  };
  const pages: CrawledPage[] = [];
  const seenUrls = new Set<string>([rootUrl]);
  const seenContentHashes = new Set<string>();
  const rootOrigin = new URL(rootUrl).origin;
  const throttle: AdaptiveThrottleState = {
    blockedFailures: 0,
    currentDelayMs: 0,
    successesSinceBlock: 0,
  };

  const publishProgress = async () => {
    await onProgress?.({ ...progress });
  };

  // Use an isolated in-memory Crawlee storage per crawl so repeated
  // indexing jobs do not reuse the persisted default request queue.
  const crawlerConfig = new Configuration({
    persistStorage: false,
    purgeOnStart: true,
  });

  const crawler = new CheerioCrawler(
    {
      maxRequestsPerCrawl: maxPages,
      maxRequestRetries: 1,
      maxConcurrency: CRAWL_MAX_CONCURRENCY,
      requestHandlerTimeoutSecs: 45,
      additionalHttpErrorStatusCodes: [403, 429],
      useSessionPool: true,
      preNavigationHooks: [
        async () => {
          if (throttle.currentDelayMs > 0) {
            await sleep(throttle.currentDelayMs);
          }
        },
      ],
      async requestHandler({ $, request, addRequests }) {
        const currentUrl =
          normalizeCrawlUrl(request.loadedUrl ?? request.url) ?? rootUrl;

        progress.visited += 1;

        const page = extractPageContent({ $, url: currentUrl });
        if (!page || seenContentHashes.has(page.contentHash)) {
          progress.skipped += 1;
        } else {
          seenContentHashes.add(page.contentHash);
          pages.push(page);
          progress.indexedPages = pages.length;
          await onPageIndexed?.(page, { ...progress });
        }

        const links = uniqueLinks({
          $,
          currentUrl,
          origin: rootOrigin,
          seenUrls,
          limit: maxPages,
        });

        if (links.length > 0) {
          progress.discovered = seenUrls.size;
          await onDiscovered?.(links);
          await addRequests(
            links.map((url) => createCrawlRequest(url, currentUrl)),
          );
        }

        noteSuccessfulRequest(throttle);
        await publishProgress();
      },
      async failedRequestHandler({ request }, error) {
        progress.failed += 1;
        const failedUrl = request.loadedUrl ?? request.url;
        const failure = describeCrawlFailure({
          url: failedUrl,
          path: urlPathname(failedUrl),
          errorMessage:
            error instanceof Error
              ? error.message
              : (request.errorMessages.at(-1) ?? null),
        });

        if (failure.blocked) {
          noteBlockedRequest(throttle);
        }

        await onFailedPage?.(failure, { ...progress });
        await publishProgress();
      },
    },
    crawlerConfig,
  );

  await crawler.run([createCrawlRequest(rootUrl)]);

  return { pages, progress: { ...progress } };
}
