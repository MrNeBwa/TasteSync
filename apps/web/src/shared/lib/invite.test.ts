import { describe, expect, it } from "vitest";
import { buildJoinUrl, extractRoomCode } from "./invite";

describe("extractRoomCode", () => {
  it("reads the code from a shareable /join/<code> link", () => {
    expect(extractRoomCode("/join/k7p2qa")).toBe("K7P2QA");
    expect(extractRoomCode("/join/K7P2QA/")).toBe("K7P2QA");
  });

  it("reads the code from a query string on any path", () => {
    expect(extractRoomCode("/", "?room=k7p2qa")).toBe("K7P2QA");
    expect(extractRoomCode("/home", "?code=K7P2QA")).toBe("K7P2QA");
  });

  it("accepts a bare code and ignores everything else", () => {
    expect(extractRoomCode("/", "?room=abcd")).toBe("ABCD");
    // The API only issues 4-8 char codes, so shorter or padded values are junk.
    expect(extractRoomCode("/", "?room=abc")).toBeNull();
    expect(extractRoomCode("/", "?room=not-a-code!")).toBeNull();
    expect(extractRoomCode("/", "")).toBeNull();
    expect(extractRoomCode("/", "?other=1")).toBeNull();
  });

  it("prefers the path code over a query code", () => {
    expect(extractRoomCode("/join/AAAAAA", "?room=BBBBBB")).toBe("AAAAAA");
  });
});

describe("buildJoinUrl", () => {
  it("builds a link the mobile QR scanner understands", () => {
    expect(buildJoinUrl("k7p2qa", "http://192.168.1.5:5173")).toBe(
      "http://192.168.1.5:5173/join/K7P2QA",
    );
  });

  it("does not double the trailing slash", () => {
    expect(buildJoinUrl("K7P2QA", "https://moviematch.app/")).toBe(
      "https://moviematch.app/join/K7P2QA",
    );
  });
});
