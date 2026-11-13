import { fileURLToPath } from "node:url";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { config } from "dotenv";

// Read-only connectivity check using .env.mcp.local, with no Note text in logs.
const client = new Client({
  name: "nuxt-note-connection-check",
  version: "0.1.0",
});
try {
  config({
    path: fileURLToPath(new URL("../.env.mcp.local", import.meta.url)),
    quiet: true,
  });
  const transport = new StreamableHTTPClientTransport(
    new URL("/mcp", process.env.NUXT_NOTE_URL ?? "http://localhost:3001"),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${process.env.NUXT_NOTE_TOKEN ?? ""}`,
        },
      },
    },
  );
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log("Connected tools:", tools.map((tool) => tool.name).join(", "));
  const list = await client.callTool({
    name: "list_notes",
    arguments: { limit: 1 },
  });
  if (list.isError) throw new Error(list.content[0].text);
  const first = list.structuredContent.notes[0];
  if (first) {
    const result = await client.callTool({
      name: "get_note",
      arguments: { id: first.id },
    });
    if (result.isError) throw new Error(result.content[0].text);
    if (
      result.structuredContent.id !== first.id ||
      typeof result.structuredContent.markdown !== "string"
    )
      throw new Error("Unexpected Note response.");
    console.log(
      "Authenticated search and full Note reading succeeded. Note content is omitted.",
    );
  } else {
    console.log(
      "Authenticated search succeeded. This user has no saved Notes yet.",
    );
  }
} catch (error) {
  console.error("MCP connection check failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
