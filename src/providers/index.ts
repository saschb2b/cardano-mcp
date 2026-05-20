import type { ServerContext } from "../context.js";
import type { Network, ProviderName } from "../types.js";
import { BlockfrostProvider } from "./blockfrost.js";
import { KoiosProvider } from "./koios.js";
import { MaestroProvider } from "./maestro.js";
import { CardanoProvider, ProviderError } from "./base.js";

export { CardanoProvider, ProviderError };

/**
 * Build a provider instance from runtime context. Per-call override of
 * provider/network is supported (see the `provider` / `network` parameters
 * on every chain-query tool) so the AI can switch backends without
 * restarting the server.
 */
export function getProvider(
  ctx: ServerContext,
  overrides: { provider?: ProviderName; network?: Network } = {},
): CardanoProvider {
  const provider = overrides.provider ?? ctx.provider;
  const network = overrides.network ?? ctx.network;

  switch (provider) {
    case "blockfrost": {
      if (!ctx.blockfrostProjectId) {
        throw new ProviderError(
          "missing_credentials",
          "Blockfrost provider requires a project id. Set BLOCKFROST_PROJECT_ID or pass --blockfrostProjectId.",
        );
      }
      return new BlockfrostProvider(network, ctx.blockfrostProjectId);
    }
    case "koios":
      return new KoiosProvider(network, ctx.koiosToken);
    case "maestro": {
      if (!ctx.maestroApiKey) {
        throw new ProviderError(
          "missing_credentials",
          "Maestro provider requires an API key. Set MAESTRO_API_KEY or pass --maestroApiKey.",
        );
      }
      return new MaestroProvider(network, ctx.maestroApiKey);
    }
    default: {
      const exhaustive: never = provider;
      throw new ProviderError(
        "unknown_provider",
        `Unknown provider: ${String(exhaustive)}`,
      );
    }
  }
}
