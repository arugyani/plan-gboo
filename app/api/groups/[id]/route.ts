import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { updateGroup } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.enum(["ghost", "pumpkin", "bat"]).optional(),
  accent: z.enum(["pumpkin", "purple", "green", "berry"]).optional(),
  discordChannelId: z
    .union([z.string().regex(/^\d{17,20}$/), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
  recapEnabled: z.boolean().optional(),
  recapHourUtc: z.number().int().min(0).max(23).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_group", "Check those group details.");
    const [{ id }, viewer] = await Promise.all([
      context.params,
      getViewer(request),
    ]);
    return Response.json({ group: await updateGroup(viewer, id, parsed.data) });
  });
}
