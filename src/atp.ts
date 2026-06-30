// Pure ATP query functions (unit-testable, no MCP/transport here).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MatchTable, type MatchRow } from "./datatable.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = path.join(__dirname, "..", "data", "atp_matches.csv");

let _table: MatchTable | null = null;
export function loadTable(csvPath: string = DEFAULT_CSV): MatchTable {
  if (!_table) _table = MatchTable.fromCsv(csvPath);
  return _table;
}
/** For tests: inject an in-memory table. */
export function setTable(t: MatchTable) {
  _table = t;
}

/** Distinct player names appearing in the dataset (winners ∪ losers). */
export function knownPlayers(): string[] {
  const set = new Set<string>();
  for (const m of loadTable().rows()) { set.add(m.winner_name); set.add(m.loser_name); }
  return [...set];
}

function brief(m: MatchRow) {
  return { date: m.tourney_date, tourney: m.tourney_name, surface: m.surface, round: m.round, winner: m.winner_name, loser: m.loser_name, score: m.score };
}

export function queryMatches(opts: { player?: string; surface?: string; year?: number; tourney?: string; round?: string; limit?: number }) {
  const all = loadTable().filter(opts);
  const limit = opts.limit ?? 10;
  return { count: all.length, matches: all.slice(0, limit).map(brief) };
}

export function headToHead(player1: string, player2: string) {
  const p1 = player1.toLowerCase(), p2 = player2.toLowerCase();
  const matches = loadTable().rows().filter((m) => {
    const w = m.winner_name.toLowerCase(), l = m.loser_name.toLowerCase();
    return (w === p1 && l === p2) || (w === p2 && l === p1);
  });
  let p1Wins = 0, p2Wins = 0;
  for (const m of matches) (m.winner_name.toLowerCase() === p1 ? p1Wins++ : p2Wins++);
  return {
    player1, player2, total: matches.length, p1Wins, p2Wins,
    matches: matches.sort((a, b) => a.tourney_date - b.tourney_date).map(brief),
  };
}

export function playerSummary(player: string) {
  const p = player.toLowerCase();
  const rows = loadTable().rows();
  const wins = rows.filter((m) => m.winner_name.toLowerCase() === p);
  const losses = rows.filter((m) => m.loser_name.toLowerCase() === p);
  const total = wins.length + losses.length;
  const bySurface: Record<string, { wins: number; losses: number }> = {};
  const bump = (s: string, key: "wins" | "losses") => {
    bySurface[s] = bySurface[s] ?? { wins: 0, losses: 0 };
    bySurface[s][key]++;
  };
  wins.forEach((m) => bump(m.surface, "wins"));
  losses.forEach((m) => bump(m.surface, "losses"));
  return {
    player,
    wins: wins.length,
    losses: losses.length,
    total,
    winPct: total ? Number(((wins.length / total) * 100).toFixed(1)) : 0,
    titles: wins.filter((m) => m.round.toUpperCase() === "F").length,
    bySurface,
  };
}
