import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { saveNotificationPreferences } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  assignments: z.boolean(),
  mentions: z.boolean(),
  dueSoon: z.boolean(),
  digest: z.enum(["off", "daily", "weekly"]),
  quietStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  quietEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  timezone: z.string().min(1).max(100),
});

export async function PATCH(request: Request) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_preferences",
        "Check those notification choices.",
      );
    const viewer = await getViewer(request);
    return Response.json({
      preferences: await saveNotificationPreferences(viewer, parsed.data),
    });
  });
}
