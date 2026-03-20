# Vectorfetch 🐕

Local-first website RAG with Next.js, Crawlee, Ollama, AI SDK, and zvec.

Vectorfetch lets you submit a website root URL, crawl that site locally, turn
the readable content into chunks and embeddings, store them in a temporary
local vector index, and chat against the indexed site with local models.

<img width="1512" height="949" alt="Preview" src="https://github.com/user-attachments/assets/4a2ecddc-870e-47f2-8137-2cf878f27c57" />

## Features

- Crawl a same-origin website recursively from a single root URL
- Extract readable HTML content and skip obvious layout noise
- Chunk and embed content locally through Ollama
- Store vectors in a local in-process zvec collection
- Chat against the active indexed site with retrieval-backed answers
- Show crawl and indexing progress in the UI while the local index builds

## How It Works

1. Submit a root URL in the app.
2. Vectorfetch crawls same-origin links recursively, up to the current crawl
   limit.
3. It extracts readable content from `main`, `article`, or `body` HTML.
4. The content is chunked into retrieval-friendly text windows.
5. Chunks are embedded locally with Ollama.
6. Embeddings and chunk metadata are written into a local zvec collection.
7. Chat requests can retrieve relevant chunks from the active site index before
   answering.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/)
- [Ollama](https://ollama.com/) running locally
- The default models pulled locally, or custom ones configured in `.env`

Default models:

- Chat: `lfm2:24b`
- Embeddings: `qwen3-embedding:0.6b`

Example:

```bash
ollama pull lfm2:24b
ollama pull qwen3-embedding:0.6b
```

### Install And Run

```bash
bun install
cp .env.example .env
bun dev
```

Then open `http://localhost:3000`.

## Model Configuration

Model selection is optional. If you do nothing, Vectorfetch uses the built-in
defaults from the app.

Environment variables:

- `VECTORFETCH_CHAT_MODEL`
- `VECTORFETCH_EMBEDDING_MODEL`
- `VECTORFETCH_CRAWL_USER_AGENT`
- `VECTORFETCH_CRAWL_MAX_CONCURRENCY`
- `VECTORFETCH_CRAWL_DELAY_MS`
- `VECTORFETCH_ZVEC_INSERT_BATCH_SIZE`

Current defaults:

```env
VECTORFETCH_CHAT_MODEL=lfm2:24b
VECTORFETCH_EMBEDDING_MODEL=qwen3-embedding:0.6b
VECTORFETCH_CRAWL_USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36
VECTORFETCH_CRAWL_MAX_CONCURRENCY=4
VECTORFETCH_CRAWL_DELAY_MS=750
VECTORFETCH_ZVEC_INSERT_BATCH_SIZE=200
```

If you want different local Ollama models, copy `.env.example` to `.env` and
replace those values.

## Crawl Behavior

Vectorfetch uses `CheerioCrawler` by default. It sends browser-like request
headers, uses a conservative crawl concurrency, and now applies request
backoff adaptively when it starts seeing blocked or rate-limited responses.
Normal sites stay fast; sites that begin returning `403` or `429` responses
are slowed down automatically to reduce avoidable blocks.

Some sites still block non-browser crawlers, especially JS-heavy or strongly
protected properties. When that happens, blocked pages are surfaced in the UI
activity feed, but the current implementation does not yet fall back to a real
browser crawler automatically.

## License

This project is licensed under the [MIT License](./LICENSE).
