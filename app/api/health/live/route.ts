export function GET() {
  return Response.json(
    { ok: true, service: "rgboo-organizer", time: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
