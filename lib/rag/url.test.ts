import { describe, expect, test } from "bun:test";

import {
  isSameOriginUrl,
  normalizeCrawlUrl,
  normalizeSubmittedUrl,
} from "@/lib/rag/url";

describe("rag url helpers", () => {
  test("normalizes submitted URLs and strips tracking params", () => {
    const normalized = normalizeSubmittedUrl(
      "docs.example.com/path/?utm_source=test&section=intro#top",
    );

    expect(normalized.toString()).toBe(
      "https://docs.example.com/path?section=intro",
    );
  });

  test("normalizes relative crawl URLs against the current page", () => {
    const normalized = normalizeCrawlUrl(
      "../pricing/?utm_medium=email",
      "https://docs.example.com/guides/getting-started",
    );

    expect(normalized).toBe("https://docs.example.com/pricing");
  });

  test("checks same-origin boundaries strictly", () => {
    expect(
      isSameOriginUrl(
        "https://docs.example.com/guide",
        "https://docs.example.com",
      ),
    ).toBe(true);
    expect(
      isSameOriginUrl(
        "http://docs.example.com/guide",
        "https://docs.example.com",
      ),
    ).toBe(false);
    expect(
      isSameOriginUrl(
        "https://blog.example.com/guide",
        "https://docs.example.com",
      ),
    ).toBe(false);
  });
});
