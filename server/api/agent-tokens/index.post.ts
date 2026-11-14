import { createError } from "nuxt/server";
import { getAuthenticatedUserId } from "../../utils/auth";
import {
  agentTokenSelect,
  newAgentToken,
  privateAgentResponse,
} from "../../utils/agent-auth";
import { getPrisma } from "../../utils/prisma";
import { agentTokenInputSchema } from "../../utils/input-schemas";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const userId = await getAuthenticatedUserId(event);
  const body: unknown = await readBody(event);
  const parsed = agentTokenInputSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Use a name of 1 to 50 characters",
    });
  }
  const { token, tokenHash } = newAgentToken();
  const record = await getPrisma().agentToken.create({
    data: { userId, name: parsed.data.name, tokenHash },
    select: agentTokenSelect,
  });
  setResponseStatus(event, 201);
  return { ...record, token };
});
