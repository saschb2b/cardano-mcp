import type {
  AddressInfo,
  AssetMetadata,
  FeeEstimate,
  Network,
  TxSummary,
  Utxo,
} from "../types.js";
import { CardanoProvider, ProviderError } from "./base.js";

const KOIOS_BASE: Record<Network, string> = {
  mainnet: "https://api.koios.rest/api/v1",
  preprod: "https://preprod.koios.rest/api/v1",
  preview: "https://preview.koios.rest/api/v1",
};

/**
 * Koios REST client. Public endpoints work without auth; a bearer token
 * unlocks higher rate limits (https://koios.rest/).
 *
 * Koios is POST-heavy (most endpoints accept arrays of addresses/units) so
 * each method here wraps a single-item request to match the same shape as
 * the other providers.
 */
export class KoiosProvider implements CardanoProvider {
  readonly name = "koios";
  private readonly base: string;
  private readonly token: string | null;

  constructor(network: Network, token: string | null) {
    this.base = KOIOS_BASE[network];
    this.token = token;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ProviderError(
        `koios_${res.status}`,
        `Koios ${res.status} on ${path}: ${text.slice(0, 500)}`,
        res.status,
      );
    }
    return (await res.json()) as T;
  }

  async getAddressInfo(address: string): Promise<AddressInfo> {
    const rows = await this.post<
      {
        address: string;
        balance: string;
        stake_address: string | null;
        utxo_set?: {
          asset_list?: {
            policy_id: string;
            asset_name: string;
            quantity: string;
          }[];
        }[];
      }[]
    >("/address_info", { _addresses: [address] });
    const row = rows[0];
    if (!row) {
      throw new ProviderError(
        "not_found",
        `Address not seen on chain: ${address}`,
        404,
      );
    }

    const amount: { unit: string; quantity: string }[] = [
      { unit: "lovelace", quantity: row.balance },
    ];
    for (const utxo of row.utxo_set ?? []) {
      for (const a of utxo.asset_list ?? []) {
        amount.push({
          unit: a.policy_id + a.asset_name,
          quantity: a.quantity,
        });
      }
    }
    return {
      address: row.address,
      amount,
      stakeAddress: row.stake_address,
    };
  }

  async getAddressUtxos(address: string): Promise<Utxo[]> {
    const rows = await this.post<
      {
        tx_hash: string;
        tx_index: number;
        address: string;
        value: string;
        datum_hash: string | null;
        inline_datum: { bytes: string } | null;
        reference_script: { hash: string } | null;
        asset_list: {
          policy_id: string;
          asset_name: string;
          quantity: string;
        }[];
      }[]
    >("/address_utxos", { _addresses: [address], _extended: true });

    return rows.map((u) => {
      const amount: { unit: string; quantity: string }[] = [
        { unit: "lovelace", quantity: u.value },
      ];
      for (const a of u.asset_list) {
        amount.push({
          unit: a.policy_id + a.asset_name,
          quantity: a.quantity,
        });
      }
      return {
        txHash: u.tx_hash,
        outputIndex: u.tx_index,
        address: u.address,
        amount,
        dataHash: u.datum_hash,
        inlineDatum: u.inline_datum?.bytes ?? null,
        referenceScriptHash: u.reference_script?.hash ?? null,
      };
    });
  }

  async getAddressTransactions(
    address: string,
    opts: { count?: number; page?: number; order?: "asc" | "desc" } = {},
  ): Promise<TxSummary[]> {
    const rows = await this.post<
      { tx_hash: string; block_height: number; block_time: number }[]
    >("/address_txs", { _addresses: [address] });
    const sorted = [...rows].sort((a, b) =>
      opts.order === "asc"
        ? a.block_time - b.block_time
        : b.block_time - a.block_time,
    );
    const offset = ((opts.page ?? 1) - 1) * (opts.count ?? 100);
    return sorted.slice(offset, offset + (opts.count ?? 100)).map((t) => ({
      txHash: t.tx_hash,
      blockHeight: t.block_height,
      blockTime: t.block_time,
    }));
  }

  async getAssetMetadata(unit: string): Promise<AssetMetadata> {
    if (unit.length < 56) {
      throw new ProviderError(
        "invalid_unit",
        `Asset unit must be policy_id (56 hex) + asset_name hex, got ${unit}`,
      );
    }
    const policyId = unit.slice(0, 56);
    const assetName = unit.slice(56);
    const rows = await this.post<
      {
        policy_id: string;
        asset_name: string;
        asset_name_ascii: string | null;
        fingerprint: string;
        total_supply: string;
        token_registry_metadata: Record<string, unknown> | null;
        minting_tx_metadata: Record<string, unknown> | null;
      }[]
    >("/asset_info", {
      _asset_list: [[policyId, assetName]],
    });
    const row = rows[0];
    if (!row) {
      throw new ProviderError("not_found", `Asset not found: ${unit}`, 404);
    }
    return {
      unit: row.policy_id + row.asset_name,
      policyId: row.policy_id,
      assetName: row.asset_name,
      fingerprint: row.fingerprint,
      quantity: row.total_supply,
      metadata: row.token_registry_metadata,
      onchainMetadata: row.minting_tx_metadata,
    };
  }

  async getAssetAddresses(
    unit: string,
  ): Promise<{ address: string; quantity: string }[]> {
    if (unit.length < 56) {
      throw new ProviderError("invalid_unit", `Invalid asset unit: ${unit}`);
    }
    const policyId = unit.slice(0, 56);
    const assetName = unit.slice(56);
    return await this.post<{ address: string; quantity: string }[]>(
      "/asset_addresses",
      { _asset_policy: policyId, _asset_name: assetName },
    );
  }

  getDatumJson(): Promise<unknown> {
    return Promise.reject(
      new ProviderError(
        "not_supported",
        "Koios does not expose datum lookup by hash. Use the Blockfrost or Maestro provider.",
      ),
    );
  }

  getDatumCbor(): Promise<string> {
    return Promise.reject(
      new ProviderError(
        "not_supported",
        "Koios does not expose datum lookup by hash. Use the Blockfrost or Maestro provider.",
      ),
    );
  }

  evaluateTransaction(): Promise<FeeEstimate> {
    return Promise.reject(
      new ProviderError(
        "not_supported",
        "Koios does not expose script evaluation. Use the Blockfrost or Maestro provider.",
      ),
    );
  }
}
