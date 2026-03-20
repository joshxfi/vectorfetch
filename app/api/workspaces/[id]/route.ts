import { z } from "zod";

import { getWorkspaceSnapshot } from "@/lib/rag/workspace";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) {
    return Response.json({ error: "Invalid workspace id." }, { status: 400 });
  }

  const workspace = await getWorkspaceSnapshot(params.data.id);
  if (!workspace) {
    return Response.json({ error: "Workspace not found." }, { status: 404 });
  }

  return Response.json(workspace);
}
