import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  createErrorResponse,
  isHash32,
  jsonResponse,
  normalizeParameters,
} from "../utils.js";
import { ProviderError, getProvider } from "../providers/index.js";

/**
 * Fetch and decode a datum by its 32-byte (64-hex-char) hash.
 *
 * `format` controls the response shape:
 *   - "json"  → provider-decoded Plutus JSON (default)
 *   - "cbor"  → raw CBOR-hex
 *   - "both"  → both representations side-by-side
 */
export async function handleGetDatum(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  if (!args.datumHash) {
    return createErrorResponse("datumHash is required");
  }
  if (!isHash32(args.datumHash)) {
    return createErrorResponse(
      `datumHash must be 64 lowercase hex chars, got: ${args.datumHash}`,
    );
  }

  const format = (args.format as string | undefined) ?? "json";
  if (!["json", "cbor", "both"].includes(format)) {
    return createErrorResponse(
      `format must be one of: json, cbor, both — got ${format}`,
    );
  }

  try {
    const provider = getProvider(ctx, {
      provider: args.provider,
      network: args.network,
    });
    const out: Record<string, unknown> = { datumHash: args.datumHash };

    if (format === "json" || format === "both") {
      out.json = await provider.getDatumJson(args.datumHash);
    }
    if (format === "cbor" || format === "both") {
      out.cbor = await provider.getDatumCbor(args.datumHash);
    }
    return jsonResponse(out);
  } catch (err) {
    if (err instanceof ProviderError) {
      return createErrorResponse(err.message, [
        err.code === "not_supported"
          ? "Set provider=blockfrost or provider=maestro for this operation"
          : "Verify the hash is for a datum that has been seen on chain",
      ]);
    }
    return createErrorResponse(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
