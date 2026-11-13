import { getAuthenticatedUserId } from "../../utils/auth";
import { agentTokenSelect, privateAgentResponse } from "../../utils/agent-auth";
import { getPrisma } from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const userId = await getAuthenticatedUserId(event);
  return getPrisma().agentToken.findMany({
    where: { userId },
    select: agentTokenSelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
});
