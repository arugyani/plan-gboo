import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { setChecklistItem } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const itemSchema = z.object({ complete: z.boolean() });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  return withApi(request, async () => {
    const parsed = itemSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_checklist_item",
        "Choose checked or unchecked.",
      );
    const viewer = await getViewer(request);
    const { id, itemId } = await params;
    return Response.json({
      item: await setChecklistItem(viewer, id, itemId, parsed.data.complete),
    });
  });
}
