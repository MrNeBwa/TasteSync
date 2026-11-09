import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./client";

describe("getErrorMessage", () => {
  it("renders a 422 validation detail instead of [object Object]", () => {
    const body = {
      detail: [
        {
          type: "missing",
          loc: ["body", "email"],
          msg: "Field required",
          input: {},
        },
        {
          type: "string_too_short",
          loc: ["body", "password"],
          msg: "String should have at least 1 character",
          input: "",
        },
      ],
    };
    const message = getErrorMessage(body, 422);
    expect(message).not.toContain("[object Object]");
    expect(message).toContain("email");
    expect(message).toContain("поле не заполнено");
    expect(message).toContain("строка не должна быть пустой");
  });

  it("keeps the raw message for errors without a known translation", () => {
    const body = {
      detail: [
        {
          type: "value_error",
          loc: ["body", "email"],
          msg: "value is not a valid email address: An email address must have an @-sign.",
          input: "bad",
        },
      ],
    };
    expect(getErrorMessage(body, 422)).toContain("email");
    expect(getErrorMessage(body, 422)).toContain("valid email address");
  });

  it("falls back to the HTTP status when there is no detail", () => {
    expect(getErrorMessage({ detail: null }, 500)).toBe("HTTP 500");
    expect(getErrorMessage(null, 503)).toBe("HTTP 503");
  });
});