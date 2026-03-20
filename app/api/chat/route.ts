import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { ollama } from "ai-sdk-ollama";
import { z } from "zod";

import { CHAT_MODEL, SEARCH_RESULT_LIMIT } from "@/lib/rag/constants";
import { getWorkspaceSnapshot, searchWorkspace } from "@/lib/rag/workspace";

const chatRequestSchema = z.object({
  siteId: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()),
});

export async function POST(req: Request) {
  const parsed = chatRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const site = await getWorkspaceSnapshot(parsed.data.siteId);
  if (!site) {
    return Response.json({ error: "Site not found." }, { status: 404 });
  }

  if (site.status !== "ready") {
    return Response.json(
      { error: "This site is still indexing and cannot answer yet." },
      { status: 409 },
    );
  }

  const result = streamText({
    model: ollama(CHAT_MODEL),
    system: [
      `You answer questions using only the indexed content from ${site.rootUrl}.`,
      "For greetings, acknowledgements, and other conversational turns that do not require site facts, respond normally without using tools.",
      "For factual questions about the indexed website, use retrieved chunks from the website before answering.",
      "If the indexed site does not contain the answer, say that clearly instead of guessing.",
      "After any grounded answer, end with a short `Sources:` list that references only the URLs you relied on.",
      "Keep answers concise and practical.",
    ].join("\n"),
    messages: await convertToModelMessages(parsed.data.messages),
    stopWhen: stepCountIs(3),
    tools: {
      searchSiteContext: tool({
        description:
          "Search the indexed website content for the most relevant chunks before answering.",
        inputSchema: z.object({
          query: z.string().min(2),
          topK: z.number().int().min(1).max(8).default(SEARCH_RESULT_LIMIT),
        }),
        execute: async ({ query, topK }) => {
          const results = await searchWorkspace({
            workspaceId: parsed.data.siteId,
            query,
            limit: topK,
          });

          return {
            query,
            results,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
