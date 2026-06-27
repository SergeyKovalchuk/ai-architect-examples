// MCP server: current weather via Open-Meteo (no API key).
// Exposes one tool: get_weather(location).
// Set OFFLINE=1 to return deterministic canned data (no network) for demos/CI.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const OFFLINE = process.env.OFFLINE === "1";

// Minimal WMO weather-code → text map.
const WMO: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 48: "rime fog", 51: "light drizzle", 61: "light rain",
  63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 80: "rain showers",
  95: "thunderstorm",
};

const CANNED: Record<string, any> = {
  berlin: { name: "Berlin", country: "Germany", temp: 18.4, code: 2, wind: 11.2 },
  london: { name: "London", country: "United Kingdom", temp: 15.1, code: 61, wind: 14.0 },
  tokyo: { name: "Tokyo", country: "Japan", temp: 26.7, code: 0, wind: 8.3 },
};

async function liveWeather(location: string) {
  const geo: any = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
  ).then((r) => r.json());
  const hit = geo?.results?.[0];
  if (!hit) throw new Error(`Location not found: ${location}`);
  const w: any = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code,wind_speed_10m`,
  ).then((r) => r.json());
  const cur = w.current;
  return { name: hit.name, country: hit.country, temp: cur.temperature_2m, code: cur.weather_code, wind: cur.wind_speed_10m };
}

function cannedWeather(location: string) {
  const key = location.trim().toLowerCase();
  if (CANNED[key]) return CANNED[key];
  // For any other city, synthesize DETERMINISTIC (clearly-offline) values from
  // a hash of the name, so offline demos still answer about the city asked.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const codes = [0, 1, 2, 3, 61, 71, 80];
  const title = location.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    name: title,
    country: "(offline sample)",
    temp: Number((-5 + (h % 350) / 10).toFixed(1)), // -5.0 .. 29.9 °C
    code: codes[h % codes.length],
    wind: Number((2 + (h % 200) / 10).toFixed(1)), // 2.0 .. 21.9 km/h
  };
}

const server = new McpServer({ name: "weather-mcp", version: "1.0.0" });

server.registerTool(
  "get_weather",
  {
    title: "Get current weather",
    description: "Get the current weather for a city or place name (temperature in °C, conditions, wind).",
    inputSchema: { location: z.string().describe("City or place name, e.g. 'Berlin'") },
  },
  async ({ location }) => {
    const d = OFFLINE ? cannedWeather(location) : await liveWeather(location);
    const text =
      `Current weather in ${d.name}, ${d.country}: ${d.temp}°C, ` +
      `${WMO[d.code] ?? "unknown conditions"}, wind ${d.wind} km/h.`;
    return {
      content: [{ type: "text", text }],
      structuredContent: { location: `${d.name}, ${d.country}`, temperatureC: d.temp, conditions: WMO[d.code] ?? "unknown", windKph: d.wind, source: OFFLINE ? "offline-canned" : "open-meteo" },
    };
  },
);

await server.connect(new StdioServerTransport());
