// News logic (pure, testable). Live = Google News RSS (no API key).
// Swap to GNews.io / NewsAPI by replacing liveNews() + adding a key.
import { config } from "./config.js";

export interface Headline { title: string; source: string; }

const CANNED: Record<string, Headline[]> = {
  tennis: [
    { title: "Alcaraz and Sinner headline the ATP Finals field", source: "Tennis Daily" },
    { title: "Djokovic confirms schedule for the clay swing", source: "Court Report" },
    { title: "Next-gen stars shake up the latest ATP rankings", source: "Baseline" },
  ],
  default: [
    { title: "Top seed advances after straight-sets win", source: "Match Wire" },
    { title: "Tournament announces revamped schedule", source: "Tour News" },
  ],
};

export function offlineNews(topic: string, limit: number): Headline[] {
  const key = topic.trim().toLowerCase();
  const pick = CANNED[key] ?? (key.includes("tennis") || key.includes("atp") ? CANNED.tennis : CANNED.default);
  return pick.slice(0, limit);
}

async function liveNews(topic: string, limit: number): Promise<Headline[]> {
  const { XMLParser } = await import("fast-xml-parser");
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } }).then((r) => r.text());
  const parsed = new XMLParser().parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, limit).map((it: any) => ({
    title: String(it.title ?? "").replace(/ - [^-]+$/, "").trim(),
    source: it.source?.["#text"] ?? it.source ?? "Google News",
  }));
}

export async function getNews(topic: string, limit = 3): Promise<Headline[]> {
  return config.offline ? offlineNews(topic, limit) : liveNews(topic, limit);
}

export function formatNews(topic: string, items: Headline[]): string {
  if (!items.length) return `No headlines found for "${topic}".`;
  return `Latest "${topic}" headlines:\n` + items.map((h, i) => `${i + 1}. ${h.title} (${h.source})`).join("\n");
}
