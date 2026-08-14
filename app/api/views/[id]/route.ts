import { getViewer } from "@/lib/server/auth";
import { deleteSavedView } from "@/lib/server/dashboard";
import { withApi } from "@/lib/server/errors";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withApi(request, async () => {
    const [{ id }, viewer] = await Promise.all([
      context.params,
      getViewer(request),
    ]);
    await deleteSavedView(viewer, id);
    return new Response(null, { status: 204 });
  });
}
