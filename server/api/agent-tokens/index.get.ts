import { getAuthenticatedUserId } from "~~/server/utils/auth";
import {
  agentTokenSelect,
  privateAgentResponse,
} from "~~/server/utils/agent-auth";
import { getPrisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const userId = await getAuthenticatedUserId(event);
  return getPrisma().agentToken.findMany({
    where: { userId },
    select: agentTokenSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
});
