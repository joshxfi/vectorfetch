import { describe, expect, test } from "bun:test";

import { chunkPages } from "@/lib/rag/text";
import type { CrawledPage } from "@/lib/rag/types";

describe("rag chunking", () => {
  test("keeps overlap between adjacent chunks", () => {
    const page: CrawledPage = {
      url: "https://docs.example.com/guide",
      path: "/guide",
      title: "Guide",
      contentHash: "hash",
      text: [
        "# Introduction",
        "This guide explains how local retrieval works in practice.",
        "## Pricing",
        "Pricing depends on chunk count and model footprint.",
        "## Support",
        "Support information lives in the support section.",
      ].join("\n\n"),
    };

    const chunks = chunkPages([page], {
      maxChars: 90,
      overlapChars: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
    const overlapTail = chunks[0]?.text.slice(-20).trim();
    expect(chunks[1]?.text.startsWith(overlapTail ?? "")).toBe(true);
  });
});
