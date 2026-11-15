# Repository Guidelines

## Commit Messages

Use Conventional Commits format: `<type>: <description>`.
Choose a prefix that matches the change, such as `feat:`, `fix:`, `refactor:`,
`docs:`, or `chore:`.

## Implementation Guidelines

- Use `~/` for imports from `app/`, `~~/` for repository-root imports
  (such as `server/` and `generated/`), and `#shared/` for `shared/`.
  Keep same-directory imports relative. Standalone Node.js scripts and tool
  configuration imports use relative paths because they run outside Nuxt/Vite.
- Prefer type inference and type narrowing in TypeScript.
- Prioritize maintainability and readability. Keep implementations simple
  while meeting requirements; avoid unnecessary complexity and excessive
  abstraction.
- When an `if` statement has `else` or `else if` branches, use braces
  for all branches.
