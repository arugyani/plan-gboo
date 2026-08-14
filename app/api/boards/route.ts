import { z } from "zod";
import { getViewer } from "@/lib/server/auth";
import { createBoard } from "@/lib/server/dashboard";
import { HttpError, readJson, withApi } from "@/lib/server/errors";

const boardSchema = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  return withApi(request, async () => {
    const parsed = boardSchema.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_board", "Give the board a short name.");
    const viewer = await getViewer(request);
    return Response.json(
      {
        board: await createBoard(viewer, parsed.data.groupId, parsed.data.name),
      },
      { status: 201 },
    );
  });
}
