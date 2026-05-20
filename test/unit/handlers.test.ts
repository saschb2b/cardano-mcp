import { describe, expect, it } from "vitest";
import { ServerContext } from "../../src/context.js";
import { handleGetAddressBalance } from "../../src/handlers/chain-handlers.js";
import { handleGetDatum } from "../../src/handlers/datum-handlers.js";
import { handleEstimateTxFees } from "../../src/handlers/fee-handlers.js";
import { handleLookupCip } from "../../src/handlers/cip-handlers.js";
import { handleResolveAdaHandle } from "../../src/handlers/handle-handlers.js";

/**
 * These tests exercise the validation paths in each handler — the parts
 * that run before any provider call. Network-touching paths are covered
 * by integration tests with real provider credentials.
 */
function ctx() {
  return new ServerContext({});
}

describe("handleGetAddressBalance — validation", () => {
  it("errors when address is missing", async () => {
    const res = await handleGetAddressBalance(ctx(), {});
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/Address is required/);
  });

  it("errors when address is not bech32", async () => {
    const res = await handleGetAddressBalance(ctx(), { address: "NOT_BECH32" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/does not look like a valid Cardano/);
  });
});

describe("handleGetDatum — validation", () => {
  it("errors when datumHash is missing", async () => {
    const res = await handleGetDatum(ctx(), {});
    expect(res.isError).toBe(true);
  });

  it("errors when datumHash is not 64 hex chars", async () => {
    const res = await handleGetDatum(ctx(), { datumHash: "deadbeef" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/64 lowercase hex/);
  });

  it("errors on bad format", async () => {
    const res = await handleGetDatum(ctx(), {
      datumHash: "a".repeat(64),
      format: "yaml",
    });
    expect(res.isError).toBe(true);
  });
});

describe("handleEstimateTxFees — validation", () => {
  it("errors when txCbor is missing", async () => {
    const res = await handleEstimateTxFees(ctx(), {});
    expect(res.isError).toBe(true);
  });

  it("errors when txCbor is not hex", async () => {
    const res = await handleEstimateTxFees(ctx(), { txCbor: "not hex!" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/lowercase hex/);
  });
});

describe("handleLookupCip — validation", () => {
  it("errors when cipNumber is missing", async () => {
    const res = await handleLookupCip(ctx(), {});
    expect(res.isError).toBe(true);
  });

  it("errors when cipNumber is out of range", async () => {
    const res = await handleLookupCip(ctx(), { cipNumber: 100_000 });
    expect(res.isError).toBe(true);
  });

  it("errors when cipNumber is not an integer", async () => {
    const res = await handleLookupCip(ctx(), { cipNumber: 1.5 });
    expect(res.isError).toBe(true);
  });
});

describe("handleResolveAdaHandle — validation", () => {
  it("errors when handle is missing", async () => {
    const res = await handleResolveAdaHandle(ctx(), {});
    expect(res.isError).toBe(true);
  });

  it("errors on illegal handle characters", async () => {
    const res = await handleResolveAdaHandle(ctx(), { handle: "$bad/handle" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toMatch(/not a valid ADA Handle/);
  });

  it("errors on handle longer than 15 chars", async () => {
    const res = await handleResolveAdaHandle(ctx(), {
      handle: "$" + "a".repeat(16),
    });
    expect(res.isError).toBe(true);
  });
});
