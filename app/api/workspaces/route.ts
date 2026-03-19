import { z } from "zod";

import { createWorkspace } from "@/lib/rag/workspace";

const createWorkspaceSchema = z.object({
  url: z.string().min(1, "A URL is required."),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = createWorkspaceSchema.safeParse(json);

    if (!parsed.success) {
      return Response.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Invalid workspace request.",
        },
        { status: 400 },
      );
    }

    const workspace = await createWorkspace(parsed.data.url);

    return Response.json({
      workspaceId: workspace.workspaceId,
      status: workspace.status,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create a website workspace.",
      },
      { status: 500 },
    );
  }
}
