import { getAuth, isDemoMode } from "@/lib/server/auth";

async function authHandler(request: Request) {
  if (isDemoMode()) {
    return Response.json(
      {
        error: {
          code: "demo_mode",
          message: "Discord sign-in is disabled in the local demo.",
        },
      },
      { status: 409 },
    );
  }
  return getAuth(new URL(request.url).origin).handler(request);
}

export {
  authHandler as GET,
  authHandler as POST,
  authHandler as PATCH,
  authHandler as PUT,
  authHandler as DELETE,
};
