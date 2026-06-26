// Structured data extraction for visualization.
// ACL-aware: extracts only from chunks the user is allowed to see, so the
// charts/graph never reveal restricted documents.
import { generateObject } from "ai";
import { z } from "zod";
import { isMock } from "./config.js";
import { store } from "./store.js";
import type { User } from "./types.js";

const companySchema = z.object({
  companies: z.array(
    z.object({
      company: z.string(),
      totalRevenueB: z.number().nullable(),
      employees: z.number().nullable(),
      regions: z.array(z.object({ name: z.string(), revenueB: z.number() })),
      productLines: z.array(z.string()),
    }),
  ),
});
export type CompanyData = z.infer<typeof companySchema>["companies"][number];

export interface VizData {
  companies: CompanyData[];
  graph: { nodes: { id: string; group: string }[]; edges: { source: string; target: string; label?: string }[] };
  revenueByRegion: { region: string; revenueB: number }[];
}

const KNOWN_REGIONS = ["Europe", "North America", "Asia", "Latin America"];

function mockExtract(texts: string[]): CompanyData[] {
  const blob = texts.join("\n");
  const companies = new Map<string, CompanyData>();

  // 1) Companies are defined ONLY by the revenue pattern (the canonical set).
  for (const m of blob.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) reported total revenue of \$([\d.]+) billion/g)) {
    companies.set(m[1], { company: m[1], totalRevenueB: Number(m[2]), employees: null, regions: [], productLines: [] });
  }
  // Resolve a raw token (e.g. "Nimbus") to a canonical company ("Nimbus Software").
  const resolve = (raw: string): CompanyData | null => {
    if (companies.has(raw)) return companies.get(raw)!;
    const first = raw.split(" ")[0];
    for (const [name, c] of companies) if (name.split(" ")[0] === first) return c;
    return null;
  };

  // 2) Employees.
  for (const m of blob.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:employed|employs) ([\d,]+) people/g)) {
    const c = resolve(m[1]);
    if (c) c.employees = Number(m[2].replace(/,/g, ""));
  }
  // 3) Region rows flattened from tables; attribute to the most recent company.
  let current: CompanyData | null = null;
  for (const sent of blob.split(/\n+/)) {
    const cm = sent.match(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) reported total revenue/);
    if (cm) current = resolve(cm[1]);
    if (!current) continue;
    for (const region of KNOWN_REGIONS) {
      const rm = sent.match(new RegExp(region + "\\s+([\\d.]+)"));
      if (rm && !current.regions.find((r) => r.name === region)) current.regions.push({ name: region, revenueB: Number(rm[1]) });
    }
  }
  // 4) Product lines.
  for (const m of blob.matchAll(/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) operates [a-z]+ product lines?: ([^.]+)\./g)) {
    const c = resolve(m[1]);
    if (c) c.productLines = m[2].split(/,|\band\b/).map((s) => s.trim()).filter(Boolean);
  }
  return [...companies.values()];
}

async function llmExtract(texts: string[]): Promise<CompanyData[]> {
  const { createAzure } = await import("@ai-sdk/azure");
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { config } = await import("./config.js");
  const model =
    config.provider === "azure"
      ? createAzure({ resourceName: config.azure.resourceName, apiKey: config.azure.apiKey })(config.azure.chat)
      : createOpenAICompatible({ name: "dial", baseURL: config.dial.baseURL, apiKey: config.dial.apiKey }).chatModel(config.dial.chat);

  const { object } = await generateObject({
    model,
    schema: companySchema,
    system: "Extract structured company financial facts ONLY from the provided text. Use null for unknown numbers. Revenue in $B.",
    prompt: texts.join("\n\n---\n\n"),
  });
  return object.companies;
}

export async function extractViz(user: User): Promise<VizData> {
  store.load();
  const texts = store.visibleTo(user.roles).map((c) => c.text);
  const companies = isMock ? mockExtract(texts) : await llmExtract(texts);

  // Build a knowledge graph: company → region, company → product line.
  const nodes = new Map<string, { id: string; group: string }>();
  const edges: { source: string; target: string; label?: string }[] = [];
  const regionTotals = new Map<string, number>();

  for (const c of companies) {
    nodes.set(c.company, { id: c.company, group: "company" });
    for (const r of c.regions) {
      nodes.set(r.name, { id: r.name, group: "region" });
      edges.push({ source: c.company, target: r.name, label: `$${r.revenueB}B` });
      regionTotals.set(r.name, (regionTotals.get(r.name) ?? 0) + r.revenueB);
    }
    for (const p of c.productLines) {
      const pid = `${p}`;
      nodes.set(pid, { id: pid, group: "product" });
      edges.push({ source: c.company, target: pid });
    }
  }

  return {
    companies,
    graph: { nodes: [...nodes.values()], edges },
    revenueByRegion: [...regionTotals.entries()].map(([region, revenueB]) => ({ region, revenueB: Number(revenueB.toFixed(2)) })),
  };
}
