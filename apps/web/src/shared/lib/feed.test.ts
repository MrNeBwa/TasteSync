import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { isStaleCardError, nextStepAfterVote } from "./feed";

const alreadyRated = () => new ApiError("User already voted for this item", 409);
const notActive = () => new ApiError("Session is not active", 409);

describe("isStaleCardError", () => {
  it("treats a duplicate vote as a stale card", () => {
    expect(isStaleCardError(alreadyRated())).toBe(true);
  });

  it("leaves every other failure alone", () => {
    expect(isStaleCardError(new ApiError("boom", 500))).toBe(false);
    expect(isStaleCardError(new ApiError("catalog empty", 503))).toBe(false);
    expect(isStaleCardError(new ApiError("nope", 404))).toBe(false);
    expect(isStaleCardError(new Error("offline"))).toBe(false);
    expect(isStaleCardError(null)).toBe(false);
  });
});

describe("nextStepAfterVote", () => {
  // Regression: a 409 used to render an error and leave the card on screen, so
  // every further click re-sent the same vote and failed the same way. The user
  // saw the room loop on one film.
  it("steps over a stale card instead of surfacing an error", () => {
    expect(nextStepAfterVote(alreadyRated(), 0, 8)).toBe("advance");
    expect(nextStepAfterVote(alreadyRated(), 6, 8)).toBe("advance");
  });

  it("replaces the batch when the stale card was the last one", () => {
    expect(nextStepAfterVote(alreadyRated(), 7, 8)).toBe("reload");
    expect(nextStepAfterVote(alreadyRated(), 0, 1)).toBe("reload");
  });

  it("reloads rather than advancing past the end of an empty feed", () => {
    expect(nextStepAfterVote(alreadyRated(), 0, 0)).toBe("reload");
  });

  it("still reports real failures as errors", () => {
    expect(nextStepAfterVote(new Error("offline"), 0, 8)).toBe("error");
    expect(nextStepAfterVote(new ApiError("catalog empty", 503), 3, 8)).toBe("error");
  });

  it("covers the finished-session 409 too, which self-corrects on reload", () => {
    // "Session is not active" is also a 409. Stepping over the card is still the
    // right default: the next batch load fails with the real reason and shows
    // it. Matching on the detail text instead would couple the client to an
    // API-owned user-visible string.
    expect(isStaleCardError(notActive())).toBe(true);
    expect(nextStepAfterVote(notActive(), 0, 8)).toBe("advance");
    // On the last card it reloads, which is where the real error surfaces.
    expect(nextStepAfterVote(notActive(), 7, 8)).toBe("reload");
  });
});
