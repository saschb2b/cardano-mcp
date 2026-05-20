import type { OperationParams, ToolResponse } from "./types.js";

/**
 * snake_case → camelCase mapping for every parameter accepted by any tool.
 * Lets the AI hand us either form without the handlers caring.
 */
export const PARAMETER_MAPPINGS: Record<string, string> = {
  address: "address",
  stake_address: "stakeAddress",
  tx_hash: "txHash",
  datum_hash: "datumHash",
  asset_unit: "assetUnit",
  policy_id: "policyId",
  asset_name: "assetName",
  handle: "handle",
  cip_number: "cipNumber",
  number: "number",
  network: "network",
  provider: "provider",
  count: "count",
  page: "page",
  order: "order",
  tx_cbor: "txCbor",
  cbor: "cbor",
  format: "format",
  include_inline_datum: "includeInlineDatum",
  with_history: "withHistory",
};

export function logDebug(debugMode: boolean, message: string): void {
  if (debugMode) {
    console.error(`[DEBUG] ${message}`);
  }
}

export function createErrorResponse(
  message: string,
  possibleSolutions: string[] = [],
): ToolResponse {
  console.error(`[SERVER] Error response: ${message}`);
  if (possibleSolutions.length > 0) {
    console.error(
      `[SERVER] Possible solutions: ${possibleSolutions.join(", ")}`,
    );
  }

  const response: ToolResponse = {
    content: [{ type: "text", text: message }],
    isError: true,
  };

  if (possibleSolutions.length > 0) {
    response.content.push({
      type: "text",
      text: "Possible solutions:\n- " + possibleSolutions.join("\n- "),
    });
  }

  return response;
}

/**
 * Convert any snake_case keys in `params` to the canonical camelCase form
 * used by handlers. Recurses into nested objects but leaves arrays alone.
 */
export function normalizeParameters(
  params: OperationParams | undefined,
): OperationParams {
  if (!params) return {};
  const result: OperationParams = {};

  for (const key in params) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) continue;
    const normalizedKey =
      key.includes("_") && PARAMETER_MAPPINGS[key]
        ? PARAMETER_MAPPINGS[key]
        : key;

    const value = params[key];
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[normalizedKey] = normalizeParameters(value as OperationParams);
    } else {
      result[normalizedKey] = value;
    }
  }

  return result;
}

/** Wrap a JSON-serialisable result in the MCP `ToolResponse` envelope. */
export function jsonResponse(payload: unknown): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/** Wrap a plain-text result in the MCP `ToolResponse` envelope. */
export function textResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  };
}

/* --- Cardano-specific validation ---------------------------------------- */

const BECH32_CHARSET = /^[a-z0-9]+$/;

/**
 * Lightweight bech32 sanity check. Rejects mixed case, missing separator,
 * forbidden characters, and obviously wrong human-readable parts. Does NOT
 * verify the checksum — the upstream provider will do that and return a
 * 400. The point here is to fail fast on garbage so we don't burn an API
 * call.
 */
export function isLikelyBech32Address(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 10 || value.length > 200) return false;
  if (value !== value.toLowerCase()) return false;
  const sep = value.lastIndexOf("1");
  if (sep < 1) return false;
  const hrp = value.slice(0, sep);
  const data = value.slice(sep + 1);
  if (!["addr", "addr_test", "stake", "stake_test"].includes(hrp)) {
    return false;
  }
  return BECH32_CHARSET.test(data);
}

/** Strict 64-char lowercase hex (sha256-like) check used for tx/datum hashes. */
export function isHash32(value: string): boolean {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

/** Strict 56-char lowercase hex policy-id check. */
export function isPolicyId(value: string): boolean {
  return typeof value === "string" && /^[0-9a-f]{56}$/.test(value);
}

/** Lowercase hex check of arbitrary even length. */
export function isHex(value: string): boolean {
  return (
    typeof value === "string" &&
    /^[0-9a-f]*$/.test(value) &&
    value.length % 2 === 0
  );
}

/**
 * Encode an ADA Handle string ($name) to the asset_name hex used on-chain.
 * The leading `$` is stripped, the remaining UTF-8 bytes are hex-encoded.
 */
export function handleToAssetNameHex(handle: string): string {
  const stripped = handle.startsWith("$") ? handle.slice(1) : handle;
  return Buffer.from(stripped, "utf8").toString("hex");
}

/** CIP-25 ADA Handle policy id (mainnet & testnets share the same policy). */
export const ADA_HANDLE_POLICY_ID =
  "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";
