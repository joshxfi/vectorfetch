import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import {
  type ZVecCollection,
  ZVecCollectionSchema,
  ZVecCreateAndOpen,
  ZVecDataType,
  ZVecIndexType,
  ZVecInitialize,
  ZVecLogLevel,
  ZVecMetricType,
  ZVecOpen,
} from "@zvec/zvec";

import { ZVEC_INSERT_BATCH_SIZE } from "@/lib/rag/constants";
import type { ChunkRecord, SearchChunkResult } from "@/lib/rag/types";

declare global {
  var __vectorfetchZVecInitialized: boolean | undefined;
}

function ensureZVecInitialized() {
  if (!globalThis.__vectorfetchZVecInitialized) {
    ZVecInitialize({ logLevel: ZVecLogLevel.ERROR });
    globalThis.__vectorfetchZVecInitialized = true;
  }
}

export async function createChunkCollection({
  collectionPath,
  chunks,
  embeddings,
  batchSize = ZVEC_INSERT_BATCH_SIZE,
  onBatchStored,
}: {
  collectionPath: string;
  chunks: ChunkRecord[];
  embeddings: number[][];
  batchSize?: number;
  onBatchStored?: (progress: {
    inserted: number;
    total: number;
    batchSize: number;
  }) => Promise<void> | void;
}) {
  ensureZVecInitialized();

  if (existsSync(collectionPath)) {
    rmSync(collectionPath, { recursive: true, force: true });
  }
  mkdirSync(path.dirname(collectionPath), { recursive: true });

  const schema = new ZVecCollectionSchema({
    name: "website_chunks",
    vectors: {
      name: "embedding",
      dataType: ZVecDataType.VECTOR_FP32,
      dimension: embeddings[0]?.length ?? 0,
      indexParams: {
        indexType: ZVecIndexType.FLAT,
        metricType: ZVecMetricType.COSINE,
      },
    },
    fields: [
      { name: "url", dataType: ZVecDataType.STRING },
      { name: "title", dataType: ZVecDataType.STRING },
      { name: "path", dataType: ZVecDataType.STRING },
      { name: "text", dataType: ZVecDataType.STRING },
      { name: "chunkIndex", dataType: ZVecDataType.INT32 },
      { name: "pageIndex", dataType: ZVecDataType.INT32 },
    ],
  });

  const collection = ZVecCreateAndOpen(collectionPath, schema);

  let inserted = 0;

  for (let index = 0; index < chunks.length; index += batchSize) {
    const batch = chunks.slice(index, index + batchSize);
    const insertStatuses = collection.insertSync(
      batch.map((chunk, batchIndex) => ({
        id: chunk.id,
        vectors: { embedding: embeddings[index + batchIndex] },
        fields: {
          url: chunk.url,
          title: chunk.title,
          path: chunk.path,
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          pageIndex: chunk.pageIndex,
        },
      })),
    );

    for (const status of insertStatuses) {
      if (!status.ok) {
        throw new Error(
          status.message || "Failed to insert vectors into zvec.",
        );
      }
    }

    inserted += batch.length;
    await onBatchStored?.({
      inserted,
      total: chunks.length,
      batchSize: batch.length,
    });
  }

  return collection;
}

export function openChunkCollection(collectionPath: string) {
  ensureZVecInitialized();

  if (!existsSync(collectionPath)) {
    return null;
  }

  return ZVecOpen(collectionPath);
}

export function closeChunkCollection(
  collection: ZVecCollection | null | undefined,
) {
  if (!collection) {
    return;
  }

  try {
    collection.closeSync();
  } catch {
    // Ignore close errors on teardown.
  }
}

export function searchChunkCollection({
  collection,
  embedding,
  limit,
}: {
  collection: ZVecCollection;
  embedding: number[];
  limit: number;
}) {
  const documents = collection.querySync({
    fieldName: "embedding",
    vector: embedding,
    topk: limit,
    outputFields: ["url", "title", "path", "text", "chunkIndex", "pageIndex"],
  });

  return documents.map((document) => ({
    id: document.id,
    url: String(document.fields.url),
    title: String(document.fields.title),
    path: String(document.fields.path),
    text: String(document.fields.text),
    chunkIndex: Number(document.fields.chunkIndex),
    pageIndex: Number(document.fields.pageIndex),
    score: document.score,
  })) satisfies SearchChunkResult[];
}
