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
    return Response.json({ error: "Invalid site id." }, { status: 400 });
  }

  const site = await getWorkspaceSnapshot(params.data.id);
  if (!site) {
    return Response.json({ error: "Site not found." }, { status: 404 });
  }

  return Response.json(site);
}
