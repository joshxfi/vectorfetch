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
  workspaceId: z.string().uuid(),
  messages: z.array(z.custom<UIMessage>()),
});

export async function POST(req: Request) {
  const parsed = chatRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const workspace = await getWorkspaceSnapshot(parsed.data.workspaceId);
  if (!workspace) {
    return Response.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (workspace.status !== "ready") {
    return Response.json(
      { error: "This workspace is still indexing and cannot answer yet." },
      { status: 409 },
    );
  }

  const result = streamText({
    model: ollama(CHAT_MODEL),
    system: [
      `You answer questions using only the indexed content from ${workspace.rootUrl}.`,
      "Always ground factual claims in retrieved chunks from the website.",
      "If the indexed site does not contain the answer, say that clearly instead of guessing.",
      "After any grounded answer, end with a short `Sources:` list that references only the URLs you relied on.",
      "Keep answers concise and practical.",
    ].join("\n"),
    messages: await convertToModelMessages(parsed.data.messages),
    stopWhen: stepCountIs(3),
    prepareStep: ({ stepNumber }) =>
      stepNumber === 1
        ? {
            toolChoice: {
              type: "tool",
              toolName: "searchSiteContext",
            },
          }
        : undefined,
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
            workspaceId: parsed.data.workspaceId,
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
