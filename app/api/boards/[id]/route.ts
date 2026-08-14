import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { updateBoard } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  note: z.string().max(500).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_board", "Check those board details.");
    const [{ id }, viewer] = await Promise.all([
      context.params,
      getViewer(request),
    ]);
    return Response.json({ board: await updateBoard(viewer, id, parsed.data) });
  });
}
