import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl, resolveWsBaseUrl } from "./config";

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
