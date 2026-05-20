# cardano-mcp

A Model Context Protocol (MCP) server that gives AI assistants read-only access to the Cardano blockchain. Query chain state, look up CIPs, resolve ADA Handles, decode Plutus datums, and estimate transaction fees + execution units.

Backed by your choice of [Blockfrost](https://docs.blockfrost.io/), [Koios](https://api.koios.rest/), or [Maestro](https://docs.gomaestro.org/).

## Tools

| Tool                       | Category | Summary                                                                               |
| -------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `get_address_balance`      | chain    | Lovelace + native token balance, stake address, address type                          |
| `get_address_utxos`        | chain    | All current UTxOs at an address (amounts, datum hash, inline datum, reference script) |
| `get_address_transactions` | chain    | Paginated tx history for an address                                                   |
| `get_asset_metadata`       | chain    | CIP-25 on-chain metadata + Token Registry off-chain metadata for a native asset       |
| `lookup_cip`               | cip      | Full markdown text of any Cardano Improvement Proposal by number                      |
| `resolve_ada_handle`       | handle   | Resolve `$name` to its current holder address                                         |
| `get_datum`                | datum    | Decode a Plutus datum by hash (json / cbor / both)                                    |
| `estimate_tx_fees`         | fees     | Minimum fee + per-redeemer execution units for an unsigned tx CBOR                    |

Every chain tool accepts optional `provider` and `network` parameters so the AI can switch backends per-call without restarting the server.

## Provider support matrix

|                                 | Blockfrost | Koios | Maestro |
| ------------------------------- | :--------: | :---: | :-----: |
| Address / UTxO / asset queries  |     ✅     |  ✅   |   ✅    |
| ADA Handle resolution           |     ✅     |  ✅   |   ✅    |
| Datum lookup                    |     ✅     |  ❌   |   ✅    |
| Tx evaluation (fees + ex-units) |     ✅     |  ❌   |   ✅    |

Pick Koios if you don't want to register for an API key and only need address/asset queries. Pick Blockfrost or Maestro for full coverage.

## Install

```sh
pnpm install
pnpm build
```

## Configuration

Set credentials for whichever provider you'll use:

| Env var                 | Required for                   | Notes                                                                            |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| `BLOCKFROST_PROJECT_ID` | `provider=blockfrost`          | Get from [blockfrost.io](https://blockfrost.io)                                  |
| `MAESTRO_API_KEY`       | `provider=maestro`             | Get from [gomaestro.org](https://gomaestro.org)                                  |
| `KOIOS_TOKEN`           | optional with `provider=koios` | Bearer token for higher rate limits                                              |
| `CARDANO_PROVIDER`      | optional                       | `blockfrost` (default) \| `koios` \| `maestro`                                   |
| `CARDANO_NETWORK`       | optional                       | `mainnet` (default) \| `preprod` \| `preview`                                    |
| `MCP_TOOLSETS`          | optional                       | Comma list of categories to expose (e.g. `chain,handle`)                         |
| `MCP_EXCLUDE_TOOLS`     | optional                       | Comma list of tool names to hide                                                 |
| `MCP_READ_ONLY`         | optional                       | `true` to hide non-read-only tools (currently a no-op — every tool is read-only) |
| `DEBUG`                 | optional                       | `true` to log handler invocations to stderr                                      |

## Use with Claude Desktop / Code

Add to your MCP client config (Claude Desktop: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cardano": {
      "command": "node",
      "args": ["/absolute/path/to/cardano-mcp/build/index.js"],
      "env": {
        "CARDANO_PROVIDER": "blockfrost",
        "CARDANO_NETWORK": "mainnet",
        "BLOCKFROST_PROJECT_ID": "mainnet_xxxxxxxx"
      }
    }
  }
}
```

Or, after `pnpm build`, run with the MCP inspector for ad-hoc testing:

```sh
pnpm inspector
```

## Development

```sh
pnpm test         # vitest run
pnpm test:watch
pnpm typecheck    # tsc --noEmit
pnpm lint
pnpm format
```

The server speaks JSON-RPC over stdio (the default MCP transport).

## Architecture

```
src/
├── index.ts              # stdio server bootstrap + env parsing
├── context.ts            # runtime state (credentials, caches, filters)
├── types.ts              # shared wire-level types
├── utils.ts              # validation, response envelopes, param normalisation
├── tool-definitions.ts   # JSON-schema for every exposed tool
├── tool-router.ts        # ListTools / CallTool dispatch
├── providers/            # Blockfrost / Koios / Maestro clients behind one interface
└── handlers/             # one file per tool category (chain, cip, handle, datum, fees)
```

Handlers stay backend-agnostic: they call `getProvider(ctx, args)` and work against the `CardanoProvider` interface in `providers/base.ts`. Adding a new backend means implementing that interface and registering it in `providers/index.ts`.

## License

MIT — see [LICENSE](LICENSE).
