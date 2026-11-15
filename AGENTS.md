# Repository Guidelines

## Commit Messages

Use Conventional Commits format: `<type>: <description>`.
Choose a prefix that matches the change, such as `feat:`, `fix:`, `refactor:`,
`docs:`, or `chore:`.

## Implementation Guidelines

- Prefer type inference and type narrowing in TypeScript.
- Prioritize maintainability and readability. Keep implementations simple
  while meeting requirements; avoid unnecessary complexity and excessive
  abstraction.
- When an `if` statement has `else` or `else if` branches, use braces
  for all branches.
