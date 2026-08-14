import { getViewer } from "@/lib/server/auth";
import { removeGitHubLink } from "@/lib/server/dashboard";
import { withApi } from "@/lib/server/errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  return withApi(request, async () => {
    const viewer = await getViewer(request);
    const { id, linkId } = await params;
    await removeGitHubLink(viewer, id, linkId);
    return new Response(null, { status: 204 });
  });
}
