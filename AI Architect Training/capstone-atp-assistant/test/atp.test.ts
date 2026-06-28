import { describe, it, expect, beforeAll } from "vitest";
import { MatchTable } from "../src/datatable.js";
import { loadTable, queryMatches, headToHead, playerSummary } from "../src/atp.js";

// Tests run against the shipped sample CSV (loaded once).
beforeAll(() => loadTable());

describe("MatchTable / CSV loading", () => {
  it("loads all rows and derives a year column", () => {
    const t = loadTable();
    expect(t.rowCount).toBe(47);
    const sample = t.rows()[0];
    expect(sample.year).toBe(2008); // tourney_date 20080608 -> 2008
    expect(sample.winner_name).toBe("Rafael Nadal");
  });
});

describe("queryMatches", () => {
  it("counts all Grass matches", () => {
    const r = queryMatches({ surface: "Grass" });
    expect(r.count).toBe(6); // Wimbledon x4 + Olympics + Wimbledon 2019
  });

  it("filters Roland Garros finals", () => {
    const r = queryMatches({ tourney: "Roland Garros", round: "F" });
    // RG finals in the sample: 2008,2011,2012,2014,2018,2019,2022 + 2022(Ruud) = 8
    expect(r.count).toBe(8);
  });

  it("filters by player + year", () => {
    const r = queryMatches({ player: "Novak Djokovic", year: 2012 });
    // AO 2012 (won vs Nadal) + RG 2012 (lost to Nadal) + US Open 2012 (lost to Murray)
    expect(r.count).toBe(3);
  });

  it("respects the limit on returned rows but not the count", () => {
    const r = queryMatches({ surface: "Hard", limit: 3 });
    expect(r.matches.length).toBe(3);
    expect(r.count).toBeGreaterThan(3);
  });
});

describe("headToHead", () => {
  it("Nadal vs Federer = 3-3 (6 matches)", () => {
    const r = headToHead("Rafael Nadal", "Roger Federer");
    expect(r.total).toBe(6);
    expect(r.p1Wins).toBe(3);
    expect(r.p2Wins).toBe(3);
  });

  it("is order-independent (swap players swaps the record)", () => {
    const r = headToHead("Roger Federer", "Rafael Nadal");
    expect(r.p1Wins).toBe(3);
    expect(r.p2Wins).toBe(3);
  });

  it("Nadal vs Djokovic = 3-2 (5 matches)", () => {
    const r = headToHead("Rafael Nadal", "Novak Djokovic");
    expect(r.total).toBe(5);
    expect(r.p1Wins).toBe(3);
    expect(r.p2Wins).toBe(2);
  });

  it("resolves current-era players: Bublik vs Rublev = 1-2 (3 matches)", () => {
    const r = headToHead("Alexander Bublik", "Andrey Rublev");
    expect(r.total).toBe(3);
    expect(r.p1Wins).toBe(1);
    expect(r.p2Wins).toBe(2);
  });

  it("returns matches sorted by date ascending", () => {
    const r = headToHead("Rafael Nadal", "Roger Federer");
    const dates = r.matches.map((m) => m.date);
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe("playerSummary", () => {
  it("computes Nadal's record, titles and surface split", () => {
    const r = playerSummary("Rafael Nadal");
    // Wins (winner==Nadal): RG08,RG11,MC08,RG12,RG14,RG11-SF,RG19,RG18,RG20-SF,RG22 = 10
    expect(r.wins).toBe(10);
    // Losses (loser==Nadal): W07,WTF10,AO12,USO11,AO14(Wawrinka),AO17(Federer) = 6
    expect(r.losses).toBe(6);
    expect(r.total).toBe(16);
    // Titles = final-round wins (exclude the 2 SF wins) = 8
    expect(r.titles).toBe(8);
    expect(r.bySurface.Clay.wins).toBe(10); // all Nadal wins here are on clay
    expect(r.bySurface.Clay.losses).toBe(0);
  });

  it("is case-insensitive", () => {
    const a = playerSummary("rafael nadal");
    const b = playerSummary("Rafael Nadal");
    expect(a.total).toBe(b.total);
  });

  it("summarizes a current-era player (Andrey Rublev)", () => {
    const r = playerSummary("Andrey Rublev");
    expect(r.wins).toBe(4);
    expect(r.losses).toBe(2);
    expect(r.titles).toBe(2); // final-round WINS: Monte Carlo + Madrid (Vienna final was a loss)
  });
});

describe("MatchTable.fromRows (engine wrapper)", () => {
  it("supports in-memory construction for custom data", () => {
    const t = MatchTable.fromRows([
      { tourney_name: "X", surface: "Clay", tourney_date: 20200101, year: 2020, round: "F", winner_name: "A", loser_name: "B", score: "6-0 6-0" },
    ]);
    expect(t.rowCount).toBe(1);
    expect(t.filter({ surface: "Clay" }).length).toBe(1);
    expect(t.filter({ surface: "Hard" }).length).toBe(0);
  });
});
