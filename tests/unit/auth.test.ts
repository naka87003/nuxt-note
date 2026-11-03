import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("nuxt/server", () => ({
  createError: (details: object) => Object.assign(new Error(), details),
}));
const session = vi.fn();
vi.stubGlobal("requireUserSession", session);
const { getAuthenticatedUserId } = await import("../../server/utils/auth");
const event = {} as Parameters<typeof getAuthenticatedUserId>[0];
const ownerId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.resetAllMocks());

describe("shared authentication", () => {
  it("returns the Note database UUID without requiring Chat's old session field", async () => {
    session.mockResolvedValue({ user: { id: ownerId } });
    await expect(getAuthenticatedUserId(event)).resolves.toBe(ownerId);
    expect(session).toHaveBeenCalledWith(event);
  });

  it("preserves an authentication rejection", async () => {
    const unauthorized = Object.assign(new Error(), { statusCode: 401 });
    session.mockRejectedValue(unauthorized);
    await expect(getAuthenticatedUserId(event)).rejects.toBe(unauthorized);
  });

  it.each([
    {},
    { databaseUserId: ownerId },
    { user: {} },
    { user: { id: null } },
    { user: { id: 123456 } },
    { user: { id: "123456" }, databaseUserId: ownerId },
    { user: { id: "" } },
    { user: { id: "not-a-uuid" } },
    { user: { id: ` ${ownerId}` } },
    { user: { id: "00000000-0000-0000-0000-000000000000" } },
  ])("rejects missing or incompatible ownership IDs: %j", async (value) => {
    session.mockResolvedValue(value);
    await expect(getAuthenticatedUserId(event)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
