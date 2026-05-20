import type { CardanoServerConfig, Network, ProviderName } from "./types.js";

const DEFAULT_PROVIDER: ProviderName = "blockfrost";
const DEFAULT_NETWORK: Network = "mainnet";

/**
 * Runtime state shared across handlers. Provider credentials live here so
 * tools can read them without re-parsing env vars on every call.
 */
export class ServerContext {
  provider: ProviderName;
  network: Network;
  blockfrostProjectId: string | null;
  maestroApiKey: string | null;
  koiosToken: string | null;
  debugMode: boolean;

  toolsets: Set<string> | null = null;
  excludeTools = new Set<string>();
  readOnly = false;

  /**
   * In-memory cache for CIP spec text — keyed by CIP number. CIPs rarely
   * change, so a lifetime-of-process cache avoids re-fetching from GitHub
   * on every lookup.
   */
  cipCache = new Map<string, string>();

  constructor(config: CardanoServerConfig) {
    this.provider =
      config.provider ??
      (process.env.CARDANO_PROVIDER as ProviderName | undefined) ??
      DEFAULT_PROVIDER;
    this.network =
      config.network ??
      (process.env.CARDANO_NETWORK as Network | undefined) ??
      DEFAULT_NETWORK;
    this.blockfrostProjectId =
      config.blockfrostProjectId ?? process.env.BLOCKFROST_PROJECT_ID ?? null;
    this.maestroApiKey =
      config.maestroApiKey ?? process.env.MAESTRO_API_KEY ?? null;
    this.koiosToken = config.koiosToken ?? process.env.KOIOS_TOKEN ?? null;
    this.debugMode = config.debugMode ?? process.env.DEBUG === "true";

    if (config.toolsets && config.toolsets.length > 0) {
      this.toolsets = new Set(config.toolsets);
    }
    if (config.excludeTools && config.excludeTools.length > 0) {
      this.excludeTools = new Set(config.excludeTools);
    }
    if (config.readOnly) {
      this.readOnly = true;
    }
  }
}
