# Vectorfetch

Local website RAG with Next.js, Crawlee, Ollama, AI SDK, and zvec.

## Model Configuration

The app uses these defaults unless you override them with environment variables:

- `VECTORFETCH_CHAT_MODEL=lfm2:24b`
- `VECTORFETCH_EMBEDDING_MODEL=qwen3-embedding:0.6b`

Copy [.env.example](/Users/joshxfi/projects/open-source/vectorfetch/.env.example) to `.env` and adjust the values if you want different local Ollama models.
