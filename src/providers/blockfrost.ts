import type {
  AddressInfo,
  AssetMetadata,
  FeeEstimate,
  Network,
  RedeemerEvaluation,
  TxSummary,
  Utxo,
} from "../types.js";
import { CardanoProvider, ProviderError } from "./base.js";

const BLOCKFROST_BASE: Record<Network, string> = {
  mainnet: "https://cardano-mainnet.blockfrost.io/api/v0",
  preprod: "https://cardano-preprod.blockfrost.io/api/v0",
  preview: "https://cardano-preview.blockfrost.io/api/v0",
};

/**
 * Blockfrost REST client. The project id is sent via the `project_id` header
 * on every request.
 *
 * @see https://docs.blockfrost.io/
 */
export class BlockfrostProvider implements CardanoProvider {
  readonly name = "blockfrost";
  private readonly base: string;
  private readonly projectId: string;

  constructor(network: Network, projectId: string) {
    this.base = BLOCKFROST_BASE[network];
    this.projectId = projectId;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: string; contentType?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      project_id: this.projectId,
      Accept: "application/json",
    };
    if (init.body !== undefined) {
      headers["Content-Type"] = init.contentType ?? "application/json";
    }

    const res = await fetch(`${this.base}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `blockfrost_${res.status}`,
        `Blockfrost ${res.status} on ${path}: ${text.slice(0, 500)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  async getAddressInfo(address: string): Promise<AddressInfo> {
    const raw = await this.request<{
      address: string;
      amount: { unit: string; quantity: string }[];
      stake_address: string | null;
      type: string;
    }>(`/addresses/${address}`);
    return {
      address: raw.address,
      amount: raw.amount,
      stakeAddress: raw.stake_address,
      type: raw.type,
    };
  }

  async getAddressUtxos(address: string): Promise<Utxo[]> {
    const raw = await this.request<
      {
        tx_hash: string;
        output_index: number;
        address: string;
        amount: { unit: string; quantity: string }[];
        data_hash: string | null;
        inline_datum: string | null;
        reference_script_hash: string | null;
      }[]
    >(`/addresses/${address}/utxos`);
    return raw.map((u) => ({
      txHash: u.tx_hash,
      outputIndex: u.output_index,
      address: u.address,
      amount: u.amount,
      dataHash: u.data_hash,
      inlineDatum: u.inline_datum,
      referenceScriptHash: u.reference_script_hash,
    }));
  }

  async getAddressTransactions(
    address: string,
    opts: { count?: number; page?: number; order?: "asc" | "desc" } = {},
  ): Promise<TxSummary[]> {
    const qs = new URLSearchParams();
    if (opts.count) qs.set("count", String(opts.count));
    if (opts.page) qs.set("page", String(opts.page));
    qs.set("order", opts.order ?? "desc");
    const raw = await this.request<
      { tx_hash: string; block_height: number; block_time: number }[]
    >(`/addresses/${address}/transactions?${qs.toString()}`);
    return raw.map((t) => ({
      txHash: t.tx_hash,
      blockHeight: t.block_height,
      blockTime: t.block_time,
    }));
  }

  async getAssetMetadata(unit: string): Promise<AssetMetadata> {
    const raw = await this.request<{
      asset: string;
      policy_id: string;
      asset_name: string | null;
      fingerprint: string;
      quantity: string;
      metadata: Record<string, unknown> | null;
      onchain_metadata: Record<string, unknown> | null;
    }>(`/assets/${unit}`);
    return {
      unit: raw.asset,
      policyId: raw.policy_id,
      assetName: raw.asset_name ?? "",
      fingerprint: raw.fingerprint,
      quantity: raw.quantity,
      metadata: raw.metadata,
      onchainMetadata: raw.onchain_metadata,
    };
  }

  async getAssetAddresses(
    unit: string,
  ): Promise<{ address: string; quantity: string }[]> {
    return await this.request<{ address: string; quantity: string }[]>(
      `/assets/${unit}/addresses`,
    );
  }

  async getDatumJson(datumHash: string): Promise<unknown> {
    const raw = await this.request<{ json_value: unknown }>(
      `/scripts/datum/${datumHash}`,
    );
    return raw.json_value;
  }

  async getDatumCbor(datumHash: string): Promise<string> {
    const raw = await this.request<{ cbor: string }>(
      `/scripts/datum/${datumHash}/cbor`,
    );
    return raw.cbor;
  }

  /**
   * Submit the unsigned tx to Blockfrost's `/utils/txs/evaluate` endpoint —
   * the same Ogmios-compatible script-evaluator that wallets use. Returns
   * per-redeemer budgets plus an estimate of the minimum fee derived from
   * tx size.
   */
  async evaluateTransaction(txCbor: string): Promise<FeeEstimate> {
    // Ogmios-style EvaluateTransaction reply.
    interface EvalResult {
      result?: {
        EvaluationResult?: Record<string, { memory: number; steps: number }>;
      };
    }
    const evalRes = await this.request<EvalResult>(`/utils/txs/evaluate`, {
      method: "POST",
      body: txCbor,
      contentType: "application/cbor",
    });

    const redeemers: RedeemerEvaluation[] = [];
    const map = evalRes.result?.EvaluationResult ?? {};
    for (const [key, budget] of Object.entries(map)) {
      // Keys are "purpose:index", e.g. "spend:0" or "mint:1".
      const [purpose, indexStr] = key.split(":");
      redeemers.push({
        validator: purpose ?? "unknown",
        index: Number(indexStr ?? 0),
        budget: { memory: budget.memory, steps: budget.steps },
      });
    }

    // Min fee is approximated as a + b * size_bytes. The protocol params
    // endpoint gives us a and b; we fetch them on demand.
    const params = await this.request<{
      min_fee_a: number;
      min_fee_b: number;
    }>(`/epochs/latest/parameters`);
    const sizeBytes = Math.floor(txCbor.length / 2);
    const minFee =
      BigInt(params.min_fee_a) * BigInt(sizeBytes) + BigInt(params.min_fee_b);

    return {
      minFee: minFee.toString(),
      redeemers,
    };
  }
}
