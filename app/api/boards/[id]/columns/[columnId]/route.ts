import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { updateColumn } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; columnId: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_column", "Check those column details.");
    const [{ id, columnId }, viewer] = await Promise.all([
      context.params,
      getViewer(request),
    ]);
    return Response.json({
      column: await updateColumn(viewer, id, columnId, parsed.data),
    });
  });
}
