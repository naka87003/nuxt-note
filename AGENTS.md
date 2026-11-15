# Repository Guidelines

## Commit Messages

Use Conventional Commits format: `<type>: <description>`.
Choose a prefix that matches the change, such as `feat:`, `fix:`, `refactor:`,
`docs:`, or `chore:`.

## Implementation Guidelines

- In TypeScript, prefer type inference and type narrowing, and avoid type
  assertions used solely to bypass type errors whenever possible.
- Prioritize maintainability and readability, and keep implementations simple
  while meeting requirements. Avoid unnecessary complexity and excessive
  abstraction.
- Use braces for `if` statements by default. Braces may be omitted for short,
  readable single-line statements. If an `else` or `else if` follows, use braces
  for all branches.
