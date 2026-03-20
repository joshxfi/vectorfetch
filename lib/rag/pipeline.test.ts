import { afterEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { workspaceCollectionPath, workspaceDir } from "@/lib/rag/manifest";
import { chunkPages } from "@/lib/rag/text";
import type { CrawledPage } from "@/lib/rag/types";
import {
  closeChunkCollection,
  createChunkCollection,
  searchChunkCollection,
} from "@/lib/rag/zvec";

function fakeEmbedding(text: string) {
  const normalized = text.toLowerCase();
  const features = ["pricing", "support", "retrieval", "docs"];

  return features.map((feature) => (normalized.includes(feature) ? 1 : 0));
}

describe("rag pipeline smoke", () => {
  const workspaceIds: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaceIds
        .splice(0)
        .map((workspaceId) =>
          rm(workspaceDir(workspaceId), { recursive: true, force: true }),
        ),
    );
  });

  test("chunks pages, indexes them in zvec, and retrieves a relevant source", async () => {
    const pages: CrawledPage[] = [
      {
        url: "https://docs.example.com",
        path: "/",
        title: "Docs Home",
        contentHash: "home",
        text: [
          "# Docs Home",
          "This site explains local retrieval and website indexing.",
          "## Pricing",
          "Pricing is based on chunk count and local model usage.",
        ].join("\n\n"),
      },
      {
        url: "https://docs.example.com/support",
        path: "/support",
        title: "Support",
        contentHash: "support",
        text: [
          "# Support",
          "Support is available through the docs site.",
          "## Troubleshooting",
          "Troubleshooting guidance lives in the support section.",
        ].join("\n\n"),
      },
    ];

    const chunks = chunkPages(pages, {
      maxChars: 140,
      overlapChars: 24,
    });
    const workspaceId = randomUUID();
    workspaceIds.push(workspaceId);

    const collection = await createChunkCollection({
      collectionPath: workspaceCollectionPath(workspaceId),
      chunks,
      embeddings: chunks.map((chunk) => fakeEmbedding(chunk.text)),
    });

    const results = searchChunkCollection({
      collection,
      embedding: fakeEmbedding("How does pricing work?"),
      limit: 3,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toContain("Docs Home");
    expect(results[0]?.text.toLowerCase()).toContain("pricing");

    closeChunkCollection(collection);
  });
});
