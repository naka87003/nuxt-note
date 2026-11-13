import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import {
  agentTokenSelect,
  newAgentToken,
  privateAgentResponse,
} from "../../utils/agent-auth";
import { getPrisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const userId = await getAuthenticatedUserId(event);
  const body: unknown = await readBody(event);
  const name =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).name
      : undefined;
  if (typeof name !== "string" || !name.trim() || name.length > 50)
    throw createError({
      statusCode: 400,
      statusMessage: "Use a name of 1 to 50 characters",
    });
  const requested = (body as Record<string, unknown>).scopes;
  const scopes = requested === undefined ? ["notes:read"] : requested;
  if (
    !Array.isArray(scopes) ||
    !scopes.includes("notes:read") ||
    scopes.some(
      (scope) => scope !== "notes:read" && scope !== "notes:create",
    ) ||
    new Set(scopes).size !== scopes.length
  )
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid token scopes",
    });
  const { token, tokenHash, expiresAt } = newAgentToken();
  const record = await getPrisma().agentToken.create({
    data: { userId, name: name.trim(), scopes, tokenHash, expiresAt },
    select: agentTokenSelect,
  });
  setResponseStatus(event, 201);
  return { ...record, token };
});
