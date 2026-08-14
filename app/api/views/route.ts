import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { createSavedView } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  boardIds: z.array(z.string()).min(1).max(50),
  filters: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .optional(),
});

export async function POST(request: Request) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_view", "Check the saved view details.");
    const viewer = await getViewer(request);
    return Response.json(
      { view: await createSavedView(viewer, parsed.data) },
      { status: 201 },
    );
  });
}
