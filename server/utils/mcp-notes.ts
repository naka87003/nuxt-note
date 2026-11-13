import { McpServer } from "@modelcontextprotocol/server";
import { createNoteTools } from "./note-tools";

// Each HTTP request gets its own instance and authenticated owner closure.
export function createRemoteNotesServer(userId: string, siteUrl: string) {
  const server = new McpServer({ name: "nuxt-note", version: "0.1.0" });
  const tools = createNoteTools(userId, siteUrl);
  server.registerTool(
    "list_categories",
    tools.list_categories,
    tools.list_categories.execute,
  );
  server.registerTool("list_notes", tools.list_notes, tools.list_notes.execute);
  server.registerTool("get_note", tools.get_note, tools.get_note.execute);
  server.registerTool(
    "create_note",
    tools.create_note,
    tools.create_note.execute,
  );
  server.registerTool(
    "update_note",
    tools.update_note,
    tools.update_note.execute,
  );
  server.registerTool(
    "delete_note",
    tools.delete_note,
    tools.delete_note.execute,
  );
  return server;
}
