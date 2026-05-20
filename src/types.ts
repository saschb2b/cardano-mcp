/**
 * Shared TypeScript types for cardano-mcp.
 */

export type Network = "mainnet" | "preprod" | "preview";

export type ProviderName = "blockfrost" | "koios" | "maestro";

export interface CardanoServerConfig {
  /** Selected upstream data provider. */
  provider?: ProviderName;
  /** Cardano network. Defaults to "mainnet". */
  network?: Network;
  /** Blockfrost project id (overrides BLOCKFROST_PROJECT_ID). */
  blockfrostProjectId?: string;
  /** Maestro API key (overrides MAESTRO_API_KEY). */
  maestroApiKey?: string;
  /** Koios bearer token for higher rate limits (overrides KOIOS_TOKEN). */
  koiosToken?: string;
  debugMode?: boolean;
  toolsets?: string[];
  excludeTools?: string[];
  readOnly?: boolean;
}

export type OperationParams = Record<string, any>;

export interface ToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

/**
 * Wire-level shape of an unspent transaction output as exposed by the
 * provider clients. Provider responses are normalised into this shape so
 * handlers don't need to know which backend served them.
 */
export interface Utxo {
  txHash: string;
  outputIndex: number;
  address: string;
  amount: { unit: string; quantity: string }[];
  dataHash?: string | null;
  inlineDatum?: string | null;
  referenceScriptHash?: string | null;
}

export interface AddressInfo {
  address: string;
  /** Total lovelace + native tokens currently held. */
  amount: { unit: string; quantity: string }[];
  /** Stake address (reward account) if the address is base/staked. */
  stakeAddress?: string | null;
  /** Type returned by the provider (e.g. "byron", "shelley"). */
  type?: string;
}

export interface TxSummary {
  txHash: string;
  blockHeight?: number;
  blockTime?: number;
  fees?: string;
  size?: number;
}

export interface AssetMetadata {
  /** Concatenation of policy id (28 bytes hex) + asset name hex. */
  unit: string;
  policyId: string;
  assetName: string;
  fingerprint?: string;
  quantity?: string;
  /** Off-chain metadata as registered in token registry (if any). */
  metadata?: Record<string, unknown> | null;
  /** On-chain metadata from CIP-25 mints. */
  onchainMetadata?: Record<string, unknown> | null;
}

export interface ExecutionUnits {
  memory: number;
  steps: number;
}

export interface RedeemerEvaluation {
  /** Redeemer purpose tag — one of: spend, mint, cert, reward, voting, propose. */
  validator: string;
  /** Index of the redeemer within its purpose group. */
  index: number;
  budget: ExecutionUnits;
}

export interface FeeEstimate {
  /** Minimum fee in lovelace based on protocol params + tx size. */
  minFee: string;
  /** Per-redeemer budgets, present if the transaction has scripts. */
  redeemers?: RedeemerEvaluation[];
}
