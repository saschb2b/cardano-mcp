import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  createErrorResponse,
  isHex,
  jsonResponse,
  normalizeParameters,
} from "../utils.js";
import { ProviderError, getProvider } from "../providers/index.js";

/**
 * Estimate the minimum fee and Plutus execution units for a constructed
 * transaction. Input is CBOR-hex of the **unsigned** tx; the provider runs
 * the script evaluator and returns per-redeemer memory/steps budgets along
 * with a min-fee estimate derived from `minFeeA * sizeBytes + minFeeB`.
 *
 * Note: the returned fee is the lower bound. If the tx has scripts, add
 * the script fees (`pricesMem * memory + pricesSteps * steps`) on top —
 * the returned `redeemers` field gives you the unit budgets to multiply
 * against current protocol prices.
 */
export async function handleEstimateTxFees(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  const txCbor = (args.txCbor ?? args.cbor) as string | undefined;
  if (!txCbor) {
    return createErrorResponse("txCbor is required (hex-encoded CBOR)", [
      "Build a transaction in your wallet/library and pass its CBOR hex",
      "The tx must be witnessed-ready but not yet submitted",
    ]);
  }
  if (!isHex(txCbor)) {
    return createErrorResponse(
      `txCbor must be lowercase hex of even length, got ${txCbor.length} chars`,
    );
  }
  if (txCbor.length < 20) {
    return createErrorResponse("txCbor is implausibly short");
  }

  try {
    const provider = getProvider(ctx, {
      provider: args.provider,
      network: args.network,
    });
    const fee = await provider.evaluateTransaction(txCbor);
    return jsonResponse(fee);
  } catch (err) {
    if (err instanceof ProviderError) {
      return createErrorResponse(err.message, [
        err.code === "not_supported"
          ? "Use provider=blockfrost or provider=maestro — Koios does not expose evaluation"
          : "Verify the tx CBOR is well-formed (try cbor.me to inspect)",
      ]);
    }
    return createErrorResponse(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
