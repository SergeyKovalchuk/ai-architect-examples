// MCP server: current weather (Open-Meteo, no key). See ../weather.ts for logic.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { config } from "../config.js";
import { getWeather, formatWeather, conditionText } from "../weather.js";

const server = new McpServer({ name: "weather-mcp", version: "1.0.0" });

server.registerTool(
  "get_weather",
  {
    title: "Get current weather",
    description: "Current weather for a city or match venue (°C, conditions, wind).",
    inputSchema: { location: z.string().describe("City or place, e.g. 'Paris'") },
  },
  async ({ location }) => {
    const w = await getWeather(location);
    return {
      content: [{ type: "text", text: formatWeather(w) }],
      structuredContent: { location: `${w.name}, ${w.country}`, temperatureC: w.temp, conditions: conditionText(w.code), windKph: w.wind, source: config.offline ? "offline-sample" : "open-meteo" },
    };
  },
);

await server.connect(new StdioServerTransport());
