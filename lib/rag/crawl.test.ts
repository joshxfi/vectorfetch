import { describe, expect, test } from "bun:test";

import {
  CRAWL_DELAY_MS,
  DEFAULT_CRAWL_DELAY_MS,
  DEFAULT_CRAWL_MAX_CONCURRENCY,
  DEFAULT_CRAWL_USER_AGENT,
  envNumberOrDefault,
  envOrDefault,
} from "@/lib/rag/constants";
import {
  collectCrawlTargets,
  createCrawlHeaders,
  describeCrawlFailure,
  getAdaptiveCrawlDelayMs,
} from "@/lib/rag/crawl";

describe("crawl hardening helpers", () => {
  test("builds browser-like crawl headers with an optional referer", () => {
    const rootHeaders = createCrawlHeaders();
    const childHeaders = createCrawlHeaders("https://example.com/docs");

    expect(rootHeaders["User-Agent"]).toBe(DEFAULT_CRAWL_USER_AGENT);
    expect(rootHeaders.Accept).toContain("text/html");
    expect(rootHeaders["Accept-Language"]).toContain("en-US");
    expect(rootHeaders["Sec-Fetch-Site"]).toBe("none");
    expect(childHeaders.Referer).toBe("https://example.com/docs");
    expect(childHeaders["Sec-Fetch-Site"]).toBe("same-origin");
  });

  test("keeps same-origin links and skips duplicates during recursive discovery", () => {
    const seenUrls = new Set(["https://example.com/docs"]);
    const links = collectCrawlTargets({
      hrefs: [
        "/guide",
        "/guide#intro",
        "https://example.com/api",
        "https://other-site.dev/blocked",
        "/guide?utm_source=test",
      ],
      currentUrl: "https://example.com/docs",
      origin: "https://example.com",
      seenUrls,
      limit: 10,
    });

    expect(links).toEqual([
      "https://example.com/guide",
      "https://example.com/api",
    ]);
  });

  test("classifies 403 and 429 failures as blocked pages", () => {
    const blocked = describeCrawlFailure({
      url: "https://example.com/admin",
      path: "/admin",
      errorMessage: "Request blocked - received 403 status code.",
    });
    const rateLimited = describeCrawlFailure({
      url: "https://example.com/docs",
      path: "/docs",
      errorMessage: "429 - Too Many Requests",
    });

    expect(blocked.blocked).toBe(true);
    expect(blocked.statusCode).toBe(403);
    expect(blocked.message).toContain("rejecting crawler requests");
    expect(rateLimited.blocked).toBe(true);
    expect(rateLimited.statusCode).toBe(429);
  });

  test("keeps non-blocked failures generic", () => {
    const failure = describeCrawlFailure({
      url: "https://example.com/missing",
      path: "/missing",
      errorMessage: "404 - Not Found",
    });

    expect(failure.blocked).toBe(false);
    expect(failure.statusCode).toBe(404);
    expect(failure.message).toBe("Failed to crawl /missing (404).");
  });

  test("applies crawl delay only after blocked failures appear", () => {
    expect(getAdaptiveCrawlDelayMs(0, DEFAULT_CRAWL_DELAY_MS)).toBe(0);
    expect(getAdaptiveCrawlDelayMs(1, DEFAULT_CRAWL_DELAY_MS)).toBe(
      DEFAULT_CRAWL_DELAY_MS,
    );
    expect(getAdaptiveCrawlDelayMs(2, DEFAULT_CRAWL_DELAY_MS)).toBe(
      DEFAULT_CRAWL_DELAY_MS * 2,
    );
    expect(getAdaptiveCrawlDelayMs(8, DEFAULT_CRAWL_DELAY_MS)).toBe(
      DEFAULT_CRAWL_DELAY_MS * 4,
    );
  });
});

describe("crawl config normalization", () => {
  test("falls back to defaults for blank or invalid env values", () => {
    expect(envOrDefault("   ", DEFAULT_CRAWL_USER_AGENT)).toBe(
      DEFAULT_CRAWL_USER_AGENT,
    );
    expect(envNumberOrDefault("oops", DEFAULT_CRAWL_MAX_CONCURRENCY)).toBe(
      DEFAULT_CRAWL_MAX_CONCURRENCY,
    );
    expect(envNumberOrDefault("-5", DEFAULT_CRAWL_DELAY_MS)).toBe(
      DEFAULT_CRAWL_DELAY_MS,
    );
  });

  test("uses the current default delay constant for adaptive crawl throttling", () => {
    expect(CRAWL_DELAY_MS).toBeGreaterThan(0);
  });
});
