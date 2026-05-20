import type { ServerContext } from "../context.js";
import type { ToolResponse } from "../types.js";
import {
  createErrorResponse,
  logDebug,
  normalizeParameters,
  textResponse,
} from "../utils.js";

const CIP_RAW_BASE =
  "https://raw.githubusercontent.com/cardano-foundation/CIPs/master";

/**
 * Look up a Cardano Improvement Proposal (CIP) by number and return its
 * spec text. Result is cached for the lifetime of the server process —
 * CIPs are versioned in git and edits land as new commits, so a long-lived
 * cache is safe.
 *
 * Each CIP lives at `CIP-XXXX/README.md` in cardano-foundation/CIPs.
 */
export async function handleLookupCip(
  ctx: ServerContext,
  rawArgs: any,
): Promise<ToolResponse> {
  const args = normalizeParameters(rawArgs);
  const numRaw = args.cipNumber ?? args.number;
  if (numRaw == null) {
    return createErrorResponse("cipNumber is required (e.g. 25, 30, 1694)");
  }

  const num = Number(numRaw);
  if (!Number.isInteger(num) || num < 0 || num > 9999) {
    return createErrorResponse(
      `cipNumber must be a positive integer 0–9999, got: ${String(numRaw)}`,
    );
  }

  const cipId = `CIP-${num.toString().padStart(4, "0")}`;
  if (ctx.cipCache.has(cipId)) {
    logDebug(ctx.debugMode, `CIP cache hit: ${cipId}`);
    return textResponse(ctx.cipCache.get(cipId)!);
  }

  const url = `${CIP_RAW_BASE}/${cipId}/README.md`;
  logDebug(ctx.debugMode, `Fetching ${url}`);

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/plain" },
    });
    if (res.status === 404) {
      return createErrorResponse(
        `${cipId} not found in cardano-foundation/CIPs.`,
        [
          "Check the CIP index at https://cips.cardano.org/",
          "The CIP may exist with a different number — search by topic instead",
        ],
      );
    }
    if (!res.ok) {
      return createErrorResponse(
        `Failed to fetch ${cipId}: HTTP ${res.status}`,
        ["Try again — GitHub rate limits unauthenticated requests"],
      );
    }
    const text = await res.text();
    ctx.cipCache.set(cipId, text);
    return textResponse(text);
  } catch (err) {
    return createErrorResponse(
      `Network error fetching ${cipId}: ${err instanceof Error ? err.message : String(err)}`,
      ["Check the host has outbound https access to raw.githubusercontent.com"],
    );
  }
}
