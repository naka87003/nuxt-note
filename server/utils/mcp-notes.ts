import { McpServer } from "@modelcontextprotocol/server";
import { createWorkspaceTools } from "./workspace-tools";

// Each HTTP request gets its own instance and authenticated owner closure.
export function createRemoteNotesServer(userId: string, siteUrl: string) {
  const server = new McpServer({ name: "nuxt-note", version: "0.1.0" });
  const tools = createWorkspaceTools(userId, siteUrl);
  // All shared workspace tools are exposed through MCP.
  for (const [name, definition] of Object.entries(tools)) {
    server.registerTool(name, definition, definition.execute);
  }
  return server;
}
