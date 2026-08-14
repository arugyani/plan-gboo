import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { addChecklistItem } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const itemSchema = z.object({ text: z.string().trim().min(1).max(500) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = itemSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_checklist_item",
        "Add a short checklist item.",
      );
    const viewer = await getViewer(request);
    const { id } = await params;
    return Response.json(
      { item: await addChecklistItem(viewer, id, parsed.data.text) },
      { status: 201 },
    );
  });
}
