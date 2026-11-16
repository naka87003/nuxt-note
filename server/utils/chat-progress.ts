// Only send fixed activity labels; tool arguments and results stay on the server.
const toolLabels: Record<string, string> = {
  list_notes: "Searching notes…",
  get_note: "Reading a note…",
  create_note: "Creating a note…",
  update_note: "Updating a note…",
  update_note_title: "Renaming a note…",
  update_note_category: "Updating a note’s category…",
  delete_note: "Deleting a note…",
  list_chats: "Searching chats…",
  get_chat: "Reading a chat…",
  update_chat_title: "Renaming a chat…",
  update_chat_category: "Updating a chat’s category…",
  delete_chat: "Deleting a chat…",
  list_categories: "Listing categories…",
  get_category: "Reading a category…",
  create_category: "Creating a category…",
  update_category: "Renaming a category…",
  delete_category: "Deleting a category…",
  move_category_notes: "Moving notes…",
  move_category_chats: "Moving chats…",
  merge_categories: "Merging categories…",
  web_search: "Searching the web…",
  read_webpage: "Reading a web page…",
};

export function chatToolProgress(toolName: string) {
  return Object.hasOwn(toolLabels, toolName)
    ? toolLabels[toolName]!
    : "Processing request…";
}
