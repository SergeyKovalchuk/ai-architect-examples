// Thin dataframe wrapper around Arquero.
// Keeping all Arquero calls behind this interface means the query engine can be
// swapped (e.g. to Danfo.js on a machine where it installs) by reimplementing
// just this file — nothing else in the app imports Arquero directly.
import fs from "node:fs";
import * as aq from "arquero";

export interface MatchRow {
  tourney_name: string;
  surface: string;
  tourney_date: number; // YYYYMMDD
  year: number;
  round: string;
  winner_name: string;
  loser_name: string;
  score: string;
}

export class MatchTable {
  private dt: ReturnType<typeof aq.from>;

  private constructor(dt: ReturnType<typeof aq.from>) {
    this.dt = dt;
  }

  /** Load matches from a CSV file and derive a `year` column. */
  static fromCsv(path: string): MatchTable {
    const text = fs.readFileSync(path, "utf8");
    const dt = aq.fromCSV(text).derive({ year: (d: any) => aq.op.floor(d.tourney_date / 10000) });
    return new MatchTable(dt);
  }

  /** For tests: build directly from row objects. */
  static fromRows(rows: MatchRow[]): MatchTable {
    return new MatchTable(aq.from(rows));
  }

  get rowCount(): number {
    return this.dt.numRows();
  }

  rows(): MatchRow[] {
    return this.dt.objects() as MatchRow[];
  }

  /** Filter by any combination of fields (case-insensitive name match). */
  filter(opts: { player?: string; surface?: string; year?: number; tourney?: string; round?: string }): MatchRow[] {
    const p = opts.player?.toLowerCase();
    const s = opts.surface?.toLowerCase();
    const t = opts.tourney?.toLowerCase();
    const r = opts.round?.toLowerCase();
    return this.rows().filter((m) => {
      if (p && m.winner_name.toLowerCase() !== p && m.loser_name.toLowerCase() !== p) return false;
      if (s && m.surface.toLowerCase() !== s) return false;
      if (opts.year && m.year !== opts.year) return false;
      if (t && !m.tourney_name.toLowerCase().includes(t)) return false;
      if (r && m.round.toLowerCase() !== r) return false;
      return true;
    });
  }

  /** Count wins grouped by player (winner_name), descending. */
  winCounts(): { player: string; wins: number }[] {
    const g = this.dt.groupby("winner_name").count().orderby(aq.desc("count")).objects() as any[];
    return g.map((x) => ({ player: x.winner_name, wins: x.count }));
  }
}
