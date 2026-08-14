import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { createGroup } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const groupSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  return withApi(request, async () => {
    const parsed = groupSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_group", "Give the group a short name.");
    const viewer = await getViewer(request);
    return Response.json(
      { group: await createGroup(viewer, parsed.data.name) },
      { status: 201 },
    );
  });
}
