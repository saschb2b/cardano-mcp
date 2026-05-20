export interface ToolDefinition {
  name: string;
  category: string;
  readOnly: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

const providerParam = {
  provider: {
    type: "string",
    enum: ["blockfrost", "koios", "maestro"],
    description:
      "Optional override for the upstream provider. Falls back to the server's configured default (CARDANO_PROVIDER env var).",
  },
  network: {
    type: "string",
    enum: ["mainnet", "preprod", "preview"],
    description:
      "Optional override for the Cardano network. Falls back to the server's configured default (CARDANO_NETWORK env var, default: mainnet).",
  },
};

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  /* ---------------- chain queries ---------------- */
  {
    name: "get_address_balance",
    category: "chain",
    readOnly: true,
    description:
      "Look up the on-chain balance of a Cardano address: total lovelace, native token holdings, stake-address, and address type. Returns JSON.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "Bech32 Cardano address. Shelley (addr1..., addr_test1...) or stake (stake1...) accepted.",
        },
        ...providerParam,
      },
      required: ["address"],
    },
  },
  {
    name: "get_address_utxos",
    category: "chain",
    readOnly: true,
    description:
      "List all current UTxOs at a Cardano address. Each UTxO includes tx hash, output index, lovelace + token amounts, optional datum hash, optional inline datum (hex), and optional reference script hash.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Bech32 Cardano address" },
        ...providerParam,
      },
      required: ["address"],
    },
  },
  {
    name: "get_address_transactions",
    category: "chain",
    readOnly: true,
    description:
      "List transactions touching an address, newest-first by default. Paginated.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Bech32 Cardano address" },
        count: {
          type: "number",
          minimum: 1,
          maximum: 100,
          description: "Page size (default 100, max 100)",
        },
        page: {
          type: "number",
          minimum: 1,
          description: "1-indexed page number",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Sort order by block time (default desc)",
        },
        ...providerParam,
      },
      required: ["address"],
    },
  },
  {
    name: "get_asset_metadata",
    category: "chain",
    readOnly: true,
    description:
      "Fetch metadata for a Cardano native asset. Accepts either `assetUnit` (policy_id + asset_name_hex, concatenated) or `policyId` + `assetName`. Returns CIP-25 onchain metadata, Cardano Token Registry off-chain metadata (if any), fingerprint, and total supply.",
    inputSchema: {
      type: "object",
      properties: {
        assetUnit: {
          type: "string",
          description:
            "Asset unit: 56-hex-char policy id concatenated with hex-encoded asset name",
        },
        policyId: {
          type: "string",
          description: "56-hex-char policy id (used with assetName)",
        },
        assetName: {
          type: "string",
          description:
            "Hex-encoded asset name (empty string for assets with no name)",
        },
        ...providerParam,
      },
    },
  },

  /* ---------------- CIPs ---------------- */
  {
    name: "lookup_cip",
    category: "cip",
    readOnly: true,
    description:
      "Look up a Cardano Improvement Proposal (CIP) by number and return its full spec text in markdown. Source: github.com/cardano-foundation/CIPs (master branch). Cached for the lifetime of the server process.",
    inputSchema: {
      type: "object",
      properties: {
        cipNumber: {
          type: "number",
          minimum: 0,
          maximum: 9999,
          description: "CIP number, e.g. 25 for CIP-0025, 1694 for CIP-1694",
        },
      },
      required: ["cipNumber"],
    },
  },

  /* ---------------- ADA Handle ---------------- */
  {
    name: "resolve_ada_handle",
    category: "handle",
    readOnly: true,
    description:
      "Resolve an ADA Handle ($name) to its current holding address. Handles are unique CIP-25 NFTs minted under policy f0ff48bb...0fb9a; the holder of the NFT owns the handle. Returns the handle, the on-chain asset unit, the policy id, the asset name hex, all current holders, and the canonical `currentHolder` address.",
    inputSchema: {
      type: "object",
      properties: {
        handle: {
          type: "string",
          description:
            "Handle to resolve. The leading `$` is optional. Letters, digits, dot, underscore, hyphen — 1–15 chars.",
        },
        ...providerParam,
      },
      required: ["handle"],
    },
  },

  /* ---------------- Datum ---------------- */
  {
    name: "get_datum",
    category: "datum",
    readOnly: true,
    description:
      "Fetch and decode a Plutus datum by its 32-byte hash. Returns JSON-decoded Plutus value, raw CBOR-hex, or both. Requires a provider that exposes datum lookup (blockfrost or maestro — Koios does not).",
    inputSchema: {
      type: "object",
      properties: {
        datumHash: {
          type: "string",
          description: "64 lowercase hex chars (sha256 of the CBOR datum)",
        },
        format: {
          type: "string",
          enum: ["json", "cbor", "both"],
          description: "Response shape, default `json`",
        },
        ...providerParam,
      },
      required: ["datumHash"],
    },
  },

  /* ---------------- Fees / eval ---------------- */
  {
    name: "estimate_tx_fees",
    category: "fees",
    readOnly: true,
    description:
      "Estimate the minimum fee (lovelace) and per-redeemer Plutus execution units (memory + CPU steps) for an unsigned transaction. Pass the tx CBOR as hex. Use this before submitting a script-spending tx so you can size redeemer budgets correctly. Requires a provider that exposes evaluation (blockfrost or maestro — Koios does not).",
    inputSchema: {
      type: "object",
      properties: {
        txCbor: {
          type: "string",
          description:
            "Hex-encoded CBOR of the unsigned transaction. Even length, lowercase hex.",
        },
        ...providerParam,
      },
      required: ["txCbor"],
    },
  },
];
