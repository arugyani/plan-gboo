import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { createCard } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const createCardSchema = z.object({
  boardId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(20_000).optional(),
  importance: z.enum(["none", "low", "medium", "high", "urgent"]).optional(),
  when: z.string().nullable().optional(),
  personIds: z.array(z.string()).max(30).optional(),
});

export async function POST(request: Request) {
  return withApi(request, async () => {
    const parsed = createCardSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_card",
        "Check the highlighted card details.",
        {
          title: parsed.error.issues[0]?.message ?? "Invalid card",
        },
      );
    }
    const viewer = await getViewer(request);
    const card = await createCard(viewer, parsed.data);
    return Response.json({ card }, { status: 201 });
  });
}
