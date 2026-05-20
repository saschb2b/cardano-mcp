import type {
  AddressInfo,
  AssetMetadata,
  FeeEstimate,
  TxSummary,
  Utxo,
} from "../types.js";

/**
 * Provider abstraction. Each backend (Blockfrost, Koios, Maestro) implements
 * this interface so handlers can stay backend-agnostic. Methods may throw
 * `ProviderError` — handlers catch it and surface to the user.
 *
 * Not every provider supports every operation (e.g. Koios does not expose
 * raw redeemer evaluation). Unsupported methods should throw
 * `new ProviderError("not_supported", "...")` rather than silently lying.
 */
export interface CardanoProvider {
  readonly name: string;

  /** Address summary: balance, stake address, type. */
  getAddressInfo(address: string): Promise<AddressInfo>;

  /** All current UTxOs at an address. Paginated by the upstream where applicable. */
  getAddressUtxos(address: string): Promise<Utxo[]>;

  /**
   * Recent transactions touching an address. `count` and `page` follow
   * Blockfrost-style pagination (1-indexed). Order is newest-first by default.
   */
  getAddressTransactions(
    address: string,
    opts?: { count?: number; page?: number; order?: "asc" | "desc" },
  ): Promise<TxSummary[]>;

  /** Metadata for an asset given its unit (policyId + assetNameHex). */
  getAssetMetadata(unit: string): Promise<AssetMetadata>;

  /**
   * Addresses currently holding an asset. Used by the ADA Handle resolver
   * — a handle is a unique NFT, so the holder list collapses to a single
   * address.
   */
  getAssetAddresses(
    unit: string,
  ): Promise<{ address: string; quantity: string }[]>;

  /** Raw JSON-decoded datum value for a given hash, if known to the provider. */
  getDatumJson(datumHash?: string): Promise<unknown>;

  /** Raw CBOR-hex datum for a given hash, if known to the provider. */
  getDatumCbor(datumHash?: string): Promise<string>;

  /**
   * Evaluate a transaction: minimum fee + per-redeemer execution units.
   * Input is the fully-built, but unsubmitted, tx as CBOR-hex.
   */
  evaluateTransaction(txCbor?: string): Promise<FeeEstimate>;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.status = status;
  }
}
