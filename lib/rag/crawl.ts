import {
  CheerioCrawler,
  type CheerioCrawlingContext,
  Configuration,
} from "@crawlee/cheerio";

import { MAX_CRAWL_PAGES } from "@/lib/rag/constants";
import { extractPageContent } from "@/lib/rag/text";
import type { CrawledPage, WorkspaceProgress } from "@/lib/rag/types";
import { isSameOriginUrl, normalizeCrawlUrl } from "@/lib/rag/url";

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
  const urls: string[] = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || seenUrls.size >= limit) {
      return;
    }

    const normalized = normalizeCrawlUrl(href, currentUrl);
    if (!normalized || !isSameOriginUrl(normalized, origin)) {
      return;
    }

    if (seenUrls.has(normalized)) {
      return;
    }

    seenUrls.add(normalized);
    urls.push(normalized);
  });

  return urls;
}

export async function crawlSite({
  rootUrl,
  maxPages = MAX_CRAWL_PAGES,
  onProgress,
}: {
  rootUrl: string;
  maxPages?: number;
  onProgress?: (progress: WorkspaceProgress) => Promise<void> | void;
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
      requestHandlerTimeoutSecs: 45,
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
          await addRequests(links);
        }

        await publishProgress();
      },
      async failedRequestHandler() {
        progress.failed += 1;
        await publishProgress();
      },
    },
    crawlerConfig,
  );

  await crawler.run([rootUrl]);

  return { pages, progress: { ...progress } };
}
