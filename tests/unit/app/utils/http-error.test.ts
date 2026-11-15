import { describe, expect, it } from "vitest";
import { getErrorStatusCode, getErrorStatusMessage } from "~/utils/http-error";

describe("HTTP error details", () => {
  it("reads status details attached to an Error", () => {
    const error = Object.assign(new Error("Request failed"), {
      statusCode: 409,
      data: { statusMessage: "Note has changed." },
    });

    expect(getErrorStatusCode(error)).toBe(409);
    expect(getErrorStatusMessage(error)).toBe("Note has changed.");
  });

  it.each([null, undefined, "Request failed", 404, {}, new Error()])(
    "handles errors without HTTP details: %s",
    (error) => {
      expect(getErrorStatusCode(error)).toBeUndefined();
      expect(getErrorStatusMessage(error)).toBeUndefined();
    },
  );

  it("ignores status details with unexpected types", () => {
    expect(getErrorStatusCode({ statusCode: "404" })).toBeUndefined();

    for (const data of [null, "unavailable", { statusMessage: 503 }]) {
      expect(getErrorStatusMessage({ data })).toBeUndefined();
    }
  });
});
