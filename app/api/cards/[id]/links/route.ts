import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { addGitHubLink } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const linkSchema = z.object({ url: z.string().trim().min(1).max(500) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const parsed = linkSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_link", "Paste a GitHub issue link.");
    const viewer = await getViewer(request);
    const { id } = await params;
    return Response.json(
      { link: await addGitHubLink(viewer, id, parsed.data.url) },
      { status: 201 },
    );
  });
}
