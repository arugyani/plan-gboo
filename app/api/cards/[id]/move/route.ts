import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { moveCard } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const moveSchema = z.object({
  columnId: z.string().min(1),
  beforeCardId: z.string().nullable().optional(),
  expectedVersion: z.number().int().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = moveSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_move", "Choose a valid destination.");
    const viewer = await getViewer(request);
    const { id } = await params;
    return Response.json({ card: await moveCard(viewer, id, parsed.data) });
  });
}
