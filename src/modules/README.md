# Module Boundaries

Business modules live here once an approved implementation phase begins.

Rules:

- Each module exposes a public `index.ts`.
- Internal implementation stays under `internal/`.
- Other modules may import only from the public module boundary.
- Route handlers and workers call application services, not repositories directly.
- Tenant-scoped modules must receive tenant context explicitly.

No business feature code belongs in the scaffold.
