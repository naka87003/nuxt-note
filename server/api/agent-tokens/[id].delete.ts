import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import { privateAgentResponse } from "../../utils/agent-auth";
import { getPrisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const userId = await getAuthenticatedUserId(event);
  const id = getRouterParam(event, "id");
  if (!id)
    throw createError({ statusCode: 404, statusMessage: "Token not found" });
  const result = await getPrisma().agentToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count)
    throw createError({ statusCode: 404, statusMessage: "Token not found" });
  setResponseStatus(event, 204);
});
