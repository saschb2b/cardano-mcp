import { describe, expect, it } from "vitest";
import {
  ADA_HANDLE_POLICY_ID,
  handleToAssetNameHex,
  isHash32,
  isHex,
  isLikelyBech32Address,
  isPolicyId,
  normalizeParameters,
} from "../../src/utils.js";

describe("normalizeParameters", () => {
  it("converts snake_case to camelCase using PARAMETER_MAPPINGS", () => {
    expect(normalizeParameters({ tx_hash: "abc" })).toEqual({ txHash: "abc" });
    expect(normalizeParameters({ asset_unit: "x", policy_id: "p" })).toEqual({
      assetUnit: "x",
      policyId: "p",
    });
  });

  it("passes through already-camelCase keys", () => {
    expect(normalizeParameters({ txHash: "abc" })).toEqual({ txHash: "abc" });
  });

  it("handles undefined input", () => {
    expect(normalizeParameters(undefined)).toEqual({});
  });

  it("recurses into nested objects but not arrays", () => {
    const out = normalizeParameters({
      tx_hash: "x",
      nested: { policy_id: "p" },
      arr: [{ tx_hash: "no-recurse" }],
    });
    expect(out).toEqual({
      txHash: "x",
      nested: { policyId: "p" },
      arr: [{ tx_hash: "no-recurse" }],
    });
  });
});

describe("isLikelyBech32Address", () => {
  it("accepts mainnet shelley addresses", () => {
    expect(
      isLikelyBech32Address(
        "addr1qxck0vc8ydzz0wmu48aue26gh68pn0lj5e0d2eu37rxct0hr9rfqsm6vyhg4z7vqkxg9rh4u9aau44yvr0cda3hccuysn90ml9",
      ),
    ).toBe(true);
  });

  it("accepts testnet shelley addresses", () => {
    expect(
      isLikelyBech32Address(
        "addr_test1qrnj8m6yqckvy4u4lk5q4cssup3ucmh4yyax4qzx0e4r5xjsxv5xprm0t3qwxsrjp0lq0uv7rpwspq4wyf6lqv0kclssudqg2j",
      ),
    ).toBe(true);
  });

  it("accepts stake addresses", () => {
    expect(
      isLikelyBech32Address(
        "stake1uxs7yc9kk7g3al4afp4z4j47kdpkxx04n0xq5ttmrn8x2lqknz4lj",
      ),
    ).toBe(true);
  });

  it("rejects mixed case", () => {
    expect(isLikelyBech32Address("Addr1XYZ")).toBe(false);
  });

  it("rejects wrong hrp", () => {
    expect(isLikelyBech32Address("foo1abcdefghijk")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isLikelyBech32Address(123 as unknown as string)).toBe(false);
  });
});

describe("hash/hex validators", () => {
  it("isHash32 accepts 64-hex strings", () => {
    expect(isHash32("a".repeat(64))).toBe(true);
    expect(isHash32("a".repeat(63))).toBe(false);
    expect(isHash32("A".repeat(64))).toBe(false);
  });

  it("isPolicyId accepts 56-hex strings", () => {
    expect(isPolicyId(ADA_HANDLE_POLICY_ID)).toBe(true);
    expect(isPolicyId("a".repeat(55))).toBe(false);
  });

  it("isHex requires even length", () => {
    expect(isHex("abcd")).toBe(true);
    expect(isHex("abc")).toBe(false);
    expect(isHex("xyz")).toBe(false);
    expect(isHex("")).toBe(true);
  });
});

describe("handleToAssetNameHex", () => {
  it("strips leading $ and hex-encodes the rest", () => {
    expect(handleToAssetNameHex("$alice")).toBe("616c696365");
    expect(handleToAssetNameHex("alice")).toBe("616c696365");
  });

  it("encodes unicode bytes", () => {
    expect(handleToAssetNameHex("$héllo")).toBe(
      Buffer.from("héllo", "utf8").toString("hex"),
    );
  });
});
