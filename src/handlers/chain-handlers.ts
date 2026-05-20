import type { ServerContext } from "../context.js";
import type { Network, ProviderName, ToolResponse } from "../types.js";
import {
  createErrorResponse,
  isLikelyBech32Address,
  isPolicyId,
  jsonResponse,
  logDebug,
  normalizeParameters,
} from "../utils.js";
import { ProviderError, getProvider } from "../providers/index.js";

interface ProviderOverride {
  provider?: ProviderName;
  network?: Network;
}

function extractOverride(args: Record<string, unknown>): ProviderOverride {
  const provider = args.provider as ProviderName | undefined;
  const network = args.network as Network | undefined;
  return { provider, network };
}

function handleProviderError(err: unknown): ToolResponse {
  if (err instanceof ProviderError) {
    return createErrorResponse(err.message, [
      err.code === "missing_credentials"
        ? "Set the appropriate API key env var (BLOCKFROST_PROJECT_ID, MAESTRO_API_KEY) or override the provider parameter."
        : "Verify the network matches the provider's project (mainnet vs preprod vs preview).",
      err.code === "not_supported"
        ? "Switch the `provider` parameter to one that supports this operation."
        : "Retry with the address/hash double-checked, or try a different provider.",
    ]);
  }
  return createErrorResponse(
    `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
  );
}

export async function handleGetAddressBalance(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  if (!args.address) {
    return createErrorResponse("Address is required", [
      "Provide a Cardano shelley address (e.g. addr1...) or stake address (stake1...)",
    ]);
  }
  if (!isLikelyBech32Address(args.address)) {
    return createErrorResponse(
      `Address does not look like a valid Cardano bech32 address: ${args.address}`,
      [
        "Use the bech32 format (addr1..., addr_test1..., stake1...)",
        "Lowercase characters only, no leading whitespace",
      ],
    );
  }
  logDebug(ctx.debugMode, `getAddressBalance ${args.address}`);
  try {
    const provider = getProvider(ctx, extractOverride(args));
    const info = await provider.getAddressInfo(args.address);
    return jsonResponse(info);
  } catch (err) {
    return handleProviderError(err);
  }
}

export async function handleGetAddressUtxos(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  if (!args.address) {
    return createErrorResponse("Address is required");
  }
  if (!isLikelyBech32Address(args.address)) {
    return createErrorResponse(`Invalid address: ${args.address}`);
  }
  try {
    const provider = getProvider(ctx, extractOverride(args));
    const utxos = await provider.getAddressUtxos(args.address);
    return jsonResponse(utxos);
  } catch (err) {
    return handleProviderError(err);
  }
}

export async function handleGetAddressTransactions(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  if (!args.address) {
    return createErrorResponse("Address is required");
  }
  if (!isLikelyBech32Address(args.address)) {
    return createErrorResponse(`Invalid address: ${args.address}`);
  }

  const count =
    typeof args.count === "number" && args.count > 0 && args.count <= 100
      ? args.count
      : undefined;
  const page =
    typeof args.page === "number" && args.page > 0 ? args.page : undefined;
  const order = args.order === "asc" ? "asc" : "desc";

  try {
    const provider = getProvider(ctx, extractOverride(args));
    const txs = await provider.getAddressTransactions(args.address, {
      count,
      page,
      order,
    });
    return jsonResponse(txs);
  } catch (err) {
    return handleProviderError(err);
  }
}

export async function handleGetAssetMetadata(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  let unit = args.assetUnit as string | undefined;
  if (!unit && args.policyId) {
    if (!isPolicyId(args.policyId)) {
      return createErrorResponse(
        `policyId must be 56 lowercase hex chars, got: ${args.policyId}`,
      );
    }
    const policyId: string = args.policyId;
    const assetName: string =
      typeof args.assetName === "string" ? args.assetName : "";
    unit = policyId + assetName;
  }
  if (!unit) {
    return createErrorResponse(
      "Provide either assetUnit (policyId+assetNameHex) or policyId + assetName",
    );
  }
  try {
    const provider = getProvider(ctx, extractOverride(args));
    const meta = await provider.getAssetMetadata(unit);
    return jsonResponse(meta);
  } catch (err) {
    return handleProviderError(err);
  }
}
