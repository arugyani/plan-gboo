import { discordCommands } from "@/lib/discord/commands";

export function GET() {
  return Response.json(discordCommands);
}
