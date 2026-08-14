import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { createTag } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.enum(["pumpkin", "purple", "green", "berry"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, "invalid_tag", "Give the tag a short name.");
    }
    const [viewer, { id }] = await Promise.all([getViewer(request), params]);
    return Response.json(
      { tag: await createTag(viewer, id, parsed.data.name, parsed.data.color) },
      { status: 201 },
    );
  });
}
