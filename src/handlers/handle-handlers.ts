import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  ADA_HANDLE_POLICY_ID,
  createErrorResponse,
  handleToAssetNameHex,
  jsonResponse,
  normalizeParameters,
} from "../utils.js";
import { ProviderError, getProvider } from "../providers/index.js";

/**
 * Resolve an ADA Handle ($name) to the currently-holding address.
 *
 * Implementation: an ADA Handle is a CIP-25 NFT with policy id
 * `f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a` and asset name
 * equal to the UTF-8 bytes of the handle (without the leading `$`),
 * hex-encoded. The current holder address resolves the handle.
 *
 * @see https://adahandle.com/
 * @see https://cips.cardano.org/cip/CIP-0025
 */
export async function handleResolveAdaHandle(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  if (!args.handle || typeof args.handle !== "string") {
    return createErrorResponse(
      "handle is required (e.g. '$alice' or just 'alice')",
    );
  }

  const cleaned = args.handle.replace(/^\$/, "");
  if (!/^[a-z0-9._-]{1,15}$/i.test(cleaned)) {
    return createErrorResponse(
      `Handle '${cleaned}' is not a valid ADA Handle. Handles are 1–15 chars: a–z, 0–9, dot, underscore, hyphen.`,
    );
  }

  const assetNameHex = handleToAssetNameHex(cleaned);
  const unit = ADA_HANDLE_POLICY_ID + assetNameHex;

  try {
    const provider = getProvider(ctx, {
      provider: args.provider,
      network: args.network,
    });
    const holders = await provider.getAssetAddresses(unit);
    if (holders.length === 0) {
      return createErrorResponse(
        `No address currently holds ADA Handle $${cleaned}.`,
        [
          "Check the spelling on https://adahandle.com",
          "The handle may not exist on this network — switch `network` to mainnet if you queried a testnet",
        ],
      );
    }
    return jsonResponse({
      handle: `$${cleaned}`,
      unit,
      policyId: ADA_HANDLE_POLICY_ID,
      assetNameHex,
      holders,
      currentHolder: holders[0]?.address,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      return createErrorResponse(err.message);
    }
    return createErrorResponse(
      `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
