# TODO

Roadmap for cardano-mcp. Tick items off as they land. Add new ideas at the bottom.

## v0.1.0 — initial release

### Tools

- [x] `get_address_balance`
- [x] `get_address_utxos`
- [x] `get_address_transactions`
- [x] `get_asset_metadata`
- [x] `lookup_cip` (with in-process spec cache)
- [x] `resolve_ada_handle`
- [x] `get_datum` (json / cbor / both)
- [x] `estimate_tx_fees` (min fee + per-redeemer ex-units)

### Providers

- [x] Blockfrost client
- [x] Koios client (with `not_supported` for datum + evaluation)
- [x] Maestro client
- [x] `getProvider()` factory + per-call provider/network override

### Infrastructure

- [x] Five-layer architecture (transport, tools, router, bridge, validation)
- [x] `MCP_TOOLSETS`, `MCP_EXCLUDE_TOOLS`, `MCP_READ_ONLY` env filters
- [x] Unit tests for utils, tool defs, router filtering, handler validation
- [x] ESLint + Prettier + tsc strict + vitest
- [x] README, CLAUDE.md, CONTRIBUTING.md

## v0.2.0 — quality of life

- [ ] Add `submit_transaction` (write-op, gated behind `--allow-submit`)
- [ ] `get_pool_info` / `get_delegation` for stake delegation queries
- [ ] `get_protocol_parameters` as its own tool (currently fetched inline by `estimate_tx_fees`)
- [ ] `get_tx_details` — full breakdown of a tx: inputs, outputs, metadata, certs
- [ ] `decode_address` — parse bech32 address into payment + stake credentials
- [ ] Integration tests against a real Blockfrost preview project (CI: skip if `BLOCKFROST_PROJECT_ID` unset)
- [ ] Persist CIP cache to disk so warm starts skip the GitHub fetch

## v0.3.0 — beyond REST

- [ ] Optional Ogmios backend (`provider=ogmios`) for direct node access
- [ ] `query_governance` — CIP-1694 voting state once the upstream APIs stabilise
- [ ] Plutus script evaluation against a forked UTxO set (Aiken-style golden tests)
- [ ] Webhook / subscription tools (`watch_address`, `watch_handle`) for long-running agents

## Ideas / unsorted

- DRep metadata lookups via Koios `/drep_info`
- NFT collection traversal: enumerate all assets under a policy id
- Token registry off-chain metadata fetcher (`https://tokens.cardano.org/`)
- Native CBOR decoder so `get_datum` can return Plutus JSON even when the provider only has CBOR
- Multi-call batching to amortise upstream rate limits
