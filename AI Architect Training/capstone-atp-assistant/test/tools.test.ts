import { describe, it, expect } from "vitest";
import { offlineWeather, conditionText, formatWeather } from "../src/weather.js";
import { offlineNews, formatNews } from "../src/news.js";

describe("weather (offline)", () => {
  it("returns curated data for a known city", () => {
    const w = offlineWeather("Paris");
    expect(w.name).toBe("Paris");
    expect(w.country).toBe("France");
    expect(w.temp).toBe(22.5);
  });

  it("synthesizes deterministic, clearly-offline data for any city", () => {
    const a = offlineWeather("Belgrade");
    const b = offlineWeather("belgrade"); // case-insensitive, same result
    expect(a).toEqual(b);
    expect(a.name).toBe("Belgrade");
    expect(a.country).toBe("(offline sample)");
    expect(a.temp).toBeGreaterThanOrEqual(-5);
    expect(a.temp).toBeLessThan(30);
  });

  it("formats a readable line", () => {
    const line = formatWeather(offlineWeather("London"));
    expect(line).toContain("London");
    expect(line).toContain("°C");
  });

  it("maps WMO codes to text", () => {
    expect(conditionText(0)).toBe("clear sky");
    expect(conditionText(999)).toBe("unknown conditions");
  });
});

describe("news (offline)", () => {
  it("returns tennis headlines for tennis-related topics", () => {
    const items = offlineNews("tennis", 3);
    expect(items.length).toBe(3);
    expect(items[0].title.length).toBeGreaterThan(0);
  });

  it("respects the limit", () => {
    expect(offlineNews("ATP rankings", 1).length).toBe(1);
  });

  it("formats a numbered list", () => {
    const text = formatNews("tennis", offlineNews("tennis", 2));
    expect(text).toContain("1.");
    expect(text).toContain("2.");
  });
});
