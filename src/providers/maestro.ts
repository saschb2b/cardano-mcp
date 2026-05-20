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

const MAESTRO_BASE: Record<Network, string> = {
  mainnet: "https://mainnet.gomaestro-api.org/v1",
  preprod: "https://preprod.gomaestro-api.org/v1",
  preview: "https://preview.gomaestro-api.org/v1",
};

/**
 * Maestro REST client. Auth is via the `api-key` header.
 *
 * @see https://docs.gomaestro.org/
 */
export class MaestroProvider implements CardanoProvider {
  readonly name = "maestro";
  private readonly base: string;
  private readonly apiKey: string;

  constructor(network: Network, apiKey: string) {
    this.base = MAESTRO_BASE[network];
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: string; contentType?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "api-key": this.apiKey,
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
        `maestro_${res.status}`,
        `Maestro ${res.status} on ${path}: ${text.slice(0, 500)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  async getAddressInfo(address: string): Promise<AddressInfo> {
    const raw = await this.request<{
      data: {
        bech32: string;
        balance: { unit: string; quantity: string }[];
        reward_address: string | null;
        network: string;
      };
    }>(`/addresses/${address}/balance`);
    return {
      address: raw.data.bech32,
      amount: raw.data.balance,
      stakeAddress: raw.data.reward_address,
    };
  }

  async getAddressUtxos(address: string): Promise<Utxo[]> {
    const raw = await this.request<{
      data: {
        tx_hash: string;
        index: number;
        address: string;
        assets: { unit: string; amount: string }[];
        datum: { hash: string | null; bytes: string | null } | null;
        reference_script: { hash: string } | null;
      }[];
    }>(`/addresses/${address}/utxos`);
    return raw.data.map((u) => ({
      txHash: u.tx_hash,
      outputIndex: u.index,
      address: u.address,
      amount: u.assets.map((a) => ({
        unit: a.unit,
        quantity: a.amount,
      })),
      dataHash: u.datum?.hash ?? null,
      inlineDatum: u.datum?.bytes ?? null,
      referenceScriptHash: u.reference_script?.hash ?? null,
    }));
  }

  async getAddressTransactions(
    address: string,
    opts: { count?: number; page?: number; order?: "asc" | "desc" } = {},
  ): Promise<TxSummary[]> {
    const qs = new URLSearchParams();
    if (opts.count) qs.set("count", String(opts.count));
    qs.set("order", opts.order ?? "desc");
    const raw = await this.request<{
      data: { tx_hash: string; slot: number; epoch_no: number }[];
    }>(`/addresses/${address}/transactions?${qs.toString()}`);
    return raw.data.map((t) => ({
      txHash: t.tx_hash,
      blockHeight: t.slot,
    }));
  }

  async getAssetMetadata(unit: string): Promise<AssetMetadata> {
    const raw = await this.request<{
      data: {
        asset_name: string;
        policy_id: string;
        asset_name_ascii: string | null;
        fingerprint: string;
        total_supply: string;
        cip25_metadata: Record<string, unknown> | null;
        token_registry_metadata: Record<string, unknown> | null;
      };
    }>(`/assets/${unit}`);
    return {
      unit: raw.data.policy_id + raw.data.asset_name,
      policyId: raw.data.policy_id,
      assetName: raw.data.asset_name,
      fingerprint: raw.data.fingerprint,
      quantity: raw.data.total_supply,
      metadata: raw.data.token_registry_metadata,
      onchainMetadata: raw.data.cip25_metadata,
    };
  }

  async getAssetAddresses(
    unit: string,
  ): Promise<{ address: string; quantity: string }[]> {
    const raw = await this.request<{
      data: { address: string; amount: string }[];
    }>(`/assets/${unit}/addresses`);
    return raw.data.map((a) => ({ address: a.address, quantity: a.amount }));
  }

  async getDatumJson(datumHash: string): Promise<unknown> {
    const raw = await this.request<{
      data: { json: unknown };
    }>(`/datum/${datumHash}`);
    return raw.data.json;
  }

  async getDatumCbor(datumHash: string): Promise<string> {
    const raw = await this.request<{
      data: { bytes: string };
    }>(`/datum/${datumHash}`);
    return raw.data.bytes;
  }

  async evaluateTransaction(txCbor: string): Promise<FeeEstimate> {
    const raw = await this.request<{
      data: {
        redeemers: {
          tag: string;
          index: number;
          ex_units: { mem: number; steps: number };
        }[];
      };
    }>(`/transactions/evaluate`, {
      method: "POST",
      body: JSON.stringify({ cbor: txCbor }),
    });
    const redeemers: RedeemerEvaluation[] = raw.data.redeemers.map((r) => ({
      validator: r.tag,
      index: r.index,
      budget: { memory: r.ex_units.mem, steps: r.ex_units.steps },
    }));

    const params = await this.request<{
      data: { min_fee_constant: number; min_fee_coefficient: number };
    }>(`/protocol-parameters`);
    const sizeBytes = Math.floor(txCbor.length / 2);
    const minFee =
      BigInt(params.data.min_fee_coefficient) * BigInt(sizeBytes) +
      BigInt(params.data.min_fee_constant);

    return { minFee: minFee.toString(), redeemers };
  }
}
