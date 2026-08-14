import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { setGroupMembership } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["organizer", "member", "view_only"]).nullable(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_membership",
        "Choose a person and a role.",
      );
    const [{ id }, viewer] = await Promise.all([
      context.params,
      getViewer(request),
    ]);
    return Response.json({
      membership: await setGroupMembership(
        viewer,
        id,
        parsed.data.userId,
        parsed.data.role,
      ),
    });
  });
}
