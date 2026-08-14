import { getViewer, isDemoMode } from "@/lib/server/auth";
import { loadDashboard } from "@/lib/server/dashboard";
import { ensureDemoData } from "@/lib/server/demo-seed";
import { withApi } from "@/lib/server/errors";

export async function GET(request: Request) {
  return withApi(request, async () => {
    if (isDemoMode()) await ensureDemoData();
    const viewer = await getViewer(request);
    return Response.json(await loadDashboard(viewer));
  });
}
