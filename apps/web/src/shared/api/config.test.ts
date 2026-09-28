import { describe, expect, it } from "vitest";
import { joinApiAssetPath, resolveApiBaseUrl, resolveWsBaseUrl } from "./config";

const lan = { hostname: "192.168.100.7", protocol: "http:" };
const vpn = { hostname: "10.214.151.154", protocol: "http:" };

describe("runtime network configuration", () => {
  it("derives the API host from the browser hostname in dev", () => {
    expect(resolveApiBaseUrl(lan, { dev: true, apiPort: "8000" })).toBe(
      "http://192.168.100.7:8000/api",
    );
    expect(resolveApiBaseUrl(vpn, { dev: true, apiPort: "8000" })).toBe(
      "http://10.214.151.154:8000/api",
    );
  });

  it("derives the websocket host from the browser hostname in dev", () => {
    expect(resolveWsBaseUrl(lan, { dev: true, apiPort: "8000" })).toBe(
      "ws://192.168.100.7:8000",
    );
  });

  it("does not let a stale localhost API env override the LAN host in dev", () => {
    expect(
      resolveApiBaseUrl(lan, {
        dev: true,
        apiPort: "8000",
        apiUrl: "http://localhost:8000/api",
      }),
    ).toBe("http://192.168.100.7:8000/api");
  });

  it("uses explicit production override outside dev", () => {
    expect(
      resolveApiBaseUrl(
        { hostname: "tastesync.example.com", protocol: "https:" },
        { dev: false, apiUrl: "https://api.example.com/api" },
      ),
    ).toBe("https://api.example.com/api");
  });
});

describe("joinApiAssetPath", () => {
  // The API base already ends in /api and server paths are absolute from the
  // origin, so a naive join yields /api/api/... and every image 404s.
  it("does not double the /api prefix", () => {
    expect(
      joinApiAssetPath(
        "http://192.168.100.7:8000/api",
        "/api/places/abc/cover.svg",
      ),
    ).toBe("http://192.168.100.7:8000/api/places/abc/cover.svg");
  });

  it("handles a base with a trailing slash", () => {
    expect(
      joinApiAssetPath("https://api.example.com/api/", "/api/places/abc/cover.svg"),
    ).toBe("https://api.example.com/api/places/abc/cover.svg");
  });

  it("accepts a path already relative to the API base", () => {
    expect(joinApiAssetPath("https://api.example.com/api", "places/abc/cover.svg")).toBe(
      "https://api.example.com/api/places/abc/cover.svg",
    );
  });

  it("leaves an already absolute URL untouched", () => {
    const remote = "https://images.example.org/photo.jpg";
    expect(joinApiAssetPath("https://api.example.com/api", remote)).toBe(remote);
  });

  it("returns null for a missing path", () => {
    expect(joinApiAssetPath("https://api.example.com/api", null)).toBeNull();
    expect(joinApiAssetPath("https://api.example.com/api", "")).toBeNull();
  });
});
