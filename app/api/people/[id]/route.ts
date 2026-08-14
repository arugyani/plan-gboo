import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { updatePersonAccess } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z
  .object({
    systemRole: z.enum(["admin", "member"]).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (value) => value.systemRole !== undefined || value.active !== undefined,
    "Choose an access change.",
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_person_access",
        "Choose a valid access change.",
      );
    }
    const [viewer, { id }] = await Promise.all([getViewer(request), params]);
    return Response.json({
      person: await updatePersonAccess(viewer, id, parsed.data),
    });
  });
}
