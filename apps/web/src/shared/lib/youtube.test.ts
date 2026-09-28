import { describe, expect, it } from "vitest";
import { getYouTubeEmbedUrl } from "./youtube";

describe("getYouTubeEmbedUrl", () => {
  it("extracts the id from every trailer link shape TMDB can produce", () => {
    const expected = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]) {
      expect(getYouTubeEmbedUrl(url)?.startsWith(expected)).toBe(true);
    }
  });

  // Regression: App.tsx appended a second "?" to the URL this function already
  // fully parameterised. Every parameter was then duplicated and one value
  // became "1?autoplay=1", which is invalid per RFC 3986. The player rejected
  // the malformed query and the trailer showed "An error occurred" instead of
  // playing.
  it("returns a URL with exactly one query string", () => {
    const url = getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(url).not.toBeNull();
    expect(url!.match(/\?/g)).toHaveLength(1);
  });

  it("emits no parameter value containing a stray question mark", () => {
    const url = getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    for (const [, value] of new URL(url!).searchParams) {
      expect(value).not.toContain("?");
    }
  });

  it("keeps the params the muted-autoplay player needs", () => {
    const url = getYouTubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const params = new URL(url!).searchParams;
    expect(params.get("autoplay")).toBe("1");
    // Without mute=1 the browser blocks autoplay and the trailer never starts.
    expect(params.get("mute")).toBe("1");
    expect(params.get("playsinline")).toBe("1");
    expect(params.get("controls")).toBe("1");
  });

  it("returns null when there is no usable id", () => {
    expect(getYouTubeEmbedUrl(null)).toBeNull();
    expect(getYouTubeEmbedUrl("")).toBeNull();
    expect(getYouTubeEmbedUrl("not-a-url")).toBeNull();
    expect(getYouTubeEmbedUrl("https://vimeo.com/12345")).toBeNull();
    expect(getYouTubeEmbedUrl("https://www.youtube.com/@somechannel")).toBeNull();
  });
});
