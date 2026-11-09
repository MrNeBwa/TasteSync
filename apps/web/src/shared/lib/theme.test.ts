import { describe, expect, it } from "vitest";
import { normalizeTheme } from "./theme";

describe("normalizeTheme", () => {
  it("accepts the two supported themes", () => {
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("light")).toBe("light");
  });

  it("falls back to light for missing or unknown values", () => {
    expect(normalizeTheme(null)).toBe("light");
    expect(normalizeTheme("")).toBe("light");
    expect(normalizeTheme("solarized")).toBe("light");
  });
});
