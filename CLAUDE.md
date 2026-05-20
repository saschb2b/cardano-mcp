# CLAUDE.md — Project Instructions for Claude Code

## Project Overview

Cardano MCP Server — a Model Context Protocol server that exposes the Cardano blockchain to AI assistants. Backed by Blockfrost, Koios, or Maestro behind a single `CardanoProvider` interface. Every tool is read-only.

## Before Every Commit

Always run the full CI validation before committing:

```sh
pnpm lint && pnpm format:check && pnpm typecheck && pnpm build && pnpm test
```

If formatting fails, fix with `pnpm format` and include the result in the commit. Do not commit code that fails any of these checks.

## Key Commands

| Command             | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `pnpm build`        | TypeScript compile to `build/`                                                   |
| `pnpm test`         | Run vitest tests                                                                 |
| `pnpm lint`         | ESLint with strict TypeScript checking                                           |
| `pnpm format:check` | Prettier formatting check                                                        |
| `pnpm format`       | Prettier write                                                                   |
| `pnpm typecheck`    | `tsc --noEmit`                                                                   |
| `pnpm inspector`    | Run the built server inside `@modelcontextprotocol/inspector` for ad-hoc testing |

## Architecture (five layers)

| Layer            | File(s)                   | Responsibility                                                            |
| ---------------- | ------------------------- | ------------------------------------------------------------------------- |
| 1. Transport     | `src/index.ts`            | stdio server bootstrap, env parsing, lifecycle                            |
| 2. Tool contract | `src/tool-definitions.ts` | JSON-Schema for every exposed tool — the AI's only documentation          |
| 3. Router        | `src/tool-router.ts`      | `ListTools` / `CallTool` dispatch, toolset/exclude/readOnly filters       |
| 4. Bridge        | `src/providers/*.ts`      | Blockfrost / Koios / Maestro clients behind `CardanoProvider` interface   |
| 5. Validation    | `src/utils.ts`            | `normalizeParameters`, bech32 / hash / hex validators, response envelopes |

`src/context.ts` holds `ServerContext` — runtime state (credentials, filters, the CIP spec cache).

## Conventions

- Always call `normalizeParameters(args)` at handler entry to accept both snake_case and camelCase from the AI.
- Validate hashes, policy ids, and bech32 addresses with the helpers in `utils.ts` before hitting a provider — fail fast on garbage rather than burning an API call.
- Wrap responses in `jsonResponse(...)` or `textResponse(...)`. Errors use `createErrorResponse(msg, possibleSolutions[])` so the AI can self-correct.
- Provider methods that aren't supported by a backend (e.g. Koios datum lookup) must throw `new ProviderError("not_supported", "...")`, not silently lie.
- Per-call provider/network overrides come from the tool args (`args.provider`, `args.network`) and are passed through `getProvider(ctx, { provider, network })`.

## Adding a New Tool

Every new tool must be reflected in **all** of these (the "four touch points"):

1. **Tool definition** — JSON schema in `src/tool-definitions.ts`. Include precise verbs, enums over free-text strings, mark required vs optional clearly. This is the only documentation the AI ever reads — invest in it.
2. **Handler** — function in `src/handlers/<domain>-handlers.ts`. Pattern: normalize → validate → call provider → wrap response.
3. **Router** — entry in `HANDLER_MAP` in `src/tool-router.ts`.
4. **Tests** — at minimum, validation-path tests in `test/unit/handlers.test.ts`.

Also update `README.md` (tool table) and `TODO.md` (check off the item if it was planned).

## Provider Coverage Matrix

| Operation                                | Blockfrost | Koios | Maestro |
| ---------------------------------------- | :--------: | :---: | :-----: |
| Address / UTxO / tx queries              |     ✅     |  ✅   |   ✅    |
| Asset metadata                           |     ✅     |  ✅   |   ✅    |
| ADA Handle (asset addresses)             |     ✅     |  ✅   |   ✅    |
| Datum lookup by hash                     |     ✅     |  ❌   |   ✅    |
| Transaction evaluation (fees + ex-units) |     ✅     |  ❌   |   ✅    |

When adding a new operation, decide upfront whether every provider can serve it. If not, return `not_supported` from the ones that can't, and document it in the tool description so the AI knows to switch `provider`.

## Testing

- Unit tests live in `test/unit/` and cover validation paths, parameter normalisation, and tool-definition shape. No network calls.
- Integration tests against real providers belong in `test/integration/` (not yet implemented — add when needed, behind an env-var guard).

## Security Notes

- Every tool is read-only — there is no transaction signing or submission path. If you add write operations, they must default to disabled and require explicit opt-in.
- Validate every user-supplied identifier (address, hash, policy id, asset name) before passing it to a provider. The helpers in `utils.ts` do bech32, 64-hex, 56-hex, and arbitrary-hex checks.
- Never log raw API keys. The `[SERVER]` startup banner reports which provider is active but not the credential.
