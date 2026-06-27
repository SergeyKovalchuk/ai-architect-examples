// Weather logic (pure, testable). Live = Open-Meteo (no API key).
// OFFLINE=1 returns deterministic, clearly-labelled sample data for any city.
import { config } from "./config.js";

const WMO: Record<number, string> = {
  0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
  45: "fog", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow",
  80: "rain showers", 95: "thunderstorm",
};

const CANNED: Record<string, Weather> = {
  paris: { name: "Paris", country: "France", temp: 22.5, code: 1, wind: 9.0 },
  london: { name: "London", country: "United Kingdom", temp: 15.1, code: 61, wind: 14.0 },
  melbourne: { name: "Melbourne", country: "Australia", temp: 28.0, code: 0, wind: 12.0 },
  "new york": { name: "New York", country: "United States", temp: 19.4, code: 2, wind: 16.0 },
};

export interface Weather {
  name: string; country: string; temp: number; code: number; wind: number;
}

export function conditionText(code: number): string {
  return WMO[code] ?? "unknown conditions";
}

/** Deterministic, clearly-offline sample for any city (so demos answer the city asked). */
export function offlineWeather(location: string): Weather {
  const key = location.trim().toLowerCase();
  if (CANNED[key]) return CANNED[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const codes = [0, 1, 2, 3, 61, 71, 80];
  return {
    name: location.trim().replace(/\b\w/g, (c) => c.toUpperCase()),
    country: "(offline sample)",
    temp: Number((-5 + (h % 350) / 10).toFixed(1)),
    code: codes[h % codes.length],
    wind: Number((2 + (h % 200) / 10).toFixed(1)),
  };
}

async function liveWeather(location: string): Promise<Weather> {
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

export async function getWeather(location: string): Promise<Weather> {
  return config.offline ? offlineWeather(location) : liveWeather(location);
}

export function formatWeather(w: Weather): string {
  return `Current weather in ${w.name}, ${w.country}: ${w.temp}°C, ${conditionText(w.code)}, wind ${w.wind} km/h.`;
}
