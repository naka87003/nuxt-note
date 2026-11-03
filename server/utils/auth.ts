import type { SessionEvent } from "#auth-utils";
import { createError } from "nuxt/server";

// User.id is the database UUID, never the GitHub numeric account ID.
const USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAuthenticatedUserId(
  event: SessionEvent,
): Promise<string> {
  const session = await requireUserSession(event);
  const id = session.user?.id;
  if (typeof id !== "string" || !USER_ID.test(id)) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return id;
}
