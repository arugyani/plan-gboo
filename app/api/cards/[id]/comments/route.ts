import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { addComment } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const noteSchema = z.object({ body: z.string().trim().min(1).max(10_000) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = noteSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_note", "Write a short note first.");
    const viewer = await getViewer(request);
    const { id } = await params;
    return Response.json(
      { comment: await addComment(viewer, id, parsed.data.body) },
      { status: 201 },
    );
  });
}
