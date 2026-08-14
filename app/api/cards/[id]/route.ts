import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { updateCard } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const patchCardSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  notes: z.string().max(20_000).optional(),
  importance: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  when: z.string().nullable().optional(),
  blocked: z.boolean().optional(),
  blockedReason: z.string().max(500).nullable().optional(),
  personIds: z.array(z.string()).max(30).optional(),
  tagIds: z.array(z.string()).max(30).optional(),
  expectedVersion: z.number().int().positive(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = patchCardSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_card",
        "Check the card details and try again.",
      );
    }
    const viewer = await getViewer(request);
    const { id } = await params;
    return Response.json({ card: await updateCard(viewer, id, parsed.data) });
  });
}
