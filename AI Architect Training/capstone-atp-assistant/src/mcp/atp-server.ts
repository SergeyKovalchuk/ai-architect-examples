// MCP server: ATP match data, backed by Arquero (see ../datatable.ts).
// Tools: query_matches, head_to_head, player_summary.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { queryMatches, headToHead, playerSummary } from "../atp.js";

const server = new McpServer({ name: "atp-data-mcp", version: "1.0.0" });

server.registerTool(
  "query_matches",
  {
    title: "Query ATP matches",
    description: "Filter ATP matches by player, surface (Clay/Grass/Hard), year, tournament, and round. Returns a count and a sample.",
    inputSchema: {
      player: z.string().optional(),
      surface: z.string().optional(),
      year: z.number().int().optional(),
      tourney: z.string().optional(),
      round: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(10),
    },
  },
  async (args) => {
    const r = queryMatches(args);
    const lines = r.matches.map((m) => `${m.date} ${m.tourney} (${m.surface}, ${m.round}): ${m.winner} def. ${m.loser} ${m.score}`);
    const text = `Found ${r.count} match(es).\n` + lines.join("\n");
    return { content: [{ type: "text", text }], structuredContent: r };
  },
);

server.registerTool(
  "head_to_head",
  {
    title: "Head-to-head record",
    description: "Win-loss record between two players, with the list of their matches.",
    inputSchema: { player1: z.string(), player2: z.string() },
  },
  async ({ player1, player2 }) => {
    const r = headToHead(player1, player2);
    const text = `${r.player1} vs ${r.player2}: ${r.p1Wins}-${r.p2Wins} (${r.total} matches)\n` +
      r.matches.map((m) => `  ${m.date} ${m.tourney} (${m.surface}): ${m.winner} won ${m.score}`).join("\n");
    return { content: [{ type: "text", text }], structuredContent: r };
  },
);

server.registerTool(
  "player_summary",
  {
    title: "Player summary",
    description: "Win/loss totals, win %, titles (final-round wins), and per-surface breakdown for a player.",
    inputSchema: { player: z.string() },
  },
  async ({ player }) => {
    const r = playerSummary(player);
    const surf = Object.entries(r.bySurface).map(([s, v]) => `${s} ${v.wins}-${v.losses}`).join(", ");
    const text = `${r.player}: ${r.wins}-${r.losses} (${r.winPct}% win), ${r.titles} title(s). By surface: ${surf}`;
    return { content: [{ type: "text", text }], structuredContent: r };
  },
);

await server.connect(new StdioServerTransport());
