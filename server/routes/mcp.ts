import { createMcpHandler } from "@modelcontextprotocol/server";
import { createError } from "nuxt/server";
import { getAgentUserId, privateAgentResponse } from "../utils/agent-auth";
import { createRemoteNotesServer } from "../utils/mcp-notes";
import { validateMcpRequest } from "../utils/mcp-http";

export default defineEventHandler(async (event) => {
  privateAgentResponse(event);
  const config = useRuntimeConfig(event);
  const request = toWebRequest(event);
  const origin = validateMcpRequest(request, {
    siteUrl: config.public.siteUrl,
    allowedOrigins: config.mcpAllowedOrigins,
    deploymentUrl: process.env.VERCEL_URL,
  });
  if (origin) {
    setHeader(event, "Access-Control-Allow-Origin", origin);
    setHeader(event, "Vary", "Origin");
    setHeader(
      event,
      "Access-Control-Expose-Headers",
      "WWW-Authenticate, MCP-Protocol-Version",
    );
  }
  if (event.method === "OPTIONS") {
    setHeader(event, "Access-Control-Allow-Methods", "POST, OPTIONS");
    setHeader(
      event,
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Method, MCP-Name",
    );
    return sendNoContent(event, 204);
  }
  if (event.method !== "POST") {
    setHeader(event, "Allow", "POST, OPTIONS");
    throw createError({ statusCode: 405, statusMessage: "Method not allowed" });
  }
  // Authenticate every exchange, including discovery and initialized clients.
  const userId = await getAgentUserId(event);
  const handler = createMcpHandler(
    () => createRemoteNotesServer(userId, config.public.siteUrl),
    {
      legacy: "stateless",
      responseMode: "json",
      maxRequestBodySize: 65_536,
      maxSubscriptions: 0,
    },
  );
  try {
    const response = await handler.fetch(request);
    response.headers.set("Cache-Control", "private, no-store");
    return await sendWebResponse(event, response);
  } finally {
    await handler.close();
  }
});
