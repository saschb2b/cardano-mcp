#!/usr/bin/env node
/**
 * Cardano MCP Server
 *
 * Model Context Protocol server exposing Cardano blockchain capabilities
 * to AI assistants. Backed by Blockfrost, Koios, or Maestro.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ServerContext } from "./context.js";
import { setupToolHandlers } from "./tool-router.js";
import type { CardanoServerConfig, Network, ProviderName } from "./types.js";

async function main(config: CardanoServerConfig = {}): Promise<void> {
  const merged: CardanoServerConfig = { ...config };

  if (!merged.toolsets && process.env.MCP_TOOLSETS) {
    merged.toolsets = process.env.MCP_TOOLSETS.split(",").map((s) => s.trim());
  }
  if (!merged.excludeTools && process.env.MCP_EXCLUDE_TOOLS) {
    merged.excludeTools = process.env.MCP_EXCLUDE_TOOLS.split(",").map((s) =>
      s.trim(),
    );
  }
  if (merged.readOnly == null && process.env.MCP_READ_ONLY === "true") {
    merged.readOnly = true;
  }
  if (!merged.provider && process.env.CARDANO_PROVIDER) {
    merged.provider = process.env.CARDANO_PROVIDER as ProviderName;
  }
  if (!merged.network && process.env.CARDANO_NETWORK) {
    merged.network = process.env.CARDANO_NETWORK as Network;
  }

  const ctx = new ServerContext(merged);

  console.error(`[SERVER] Provider: ${ctx.provider} | Network: ${ctx.network}`);
  if (ctx.toolsets) {
    console.error(
      `[SERVER] Toolset filter active: ${[...ctx.toolsets].join(", ")}`,
    );
  }
  if (ctx.excludeTools.size > 0) {
    console.error(
      `[SERVER] Excluded tools: ${[...ctx.excludeTools].join(", ")}`,
    );
  }
  if (ctx.readOnly) {
    console.error(
      "[SERVER] Read-only mode (no-op for this server: all tools are read-only)",
    );
  }

  if (ctx.provider === "blockfrost" && !ctx.blockfrostProjectId) {
    console.error(
      "[SERVER] WARNING: provider=blockfrost but BLOCKFROST_PROJECT_ID is not set. Tool calls will fail until credentials are provided.",
    );
  }
  if (ctx.provider === "maestro" && !ctx.maestroApiKey) {
    console.error(
      "[SERVER] WARNING: provider=maestro but MAESTRO_API_KEY is not set. Tool calls will fail until credentials are provided.",
    );
  }

  const server = new Server(
    { name: "cardano-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.onerror = (error) => console.error("[MCP Error]", error);

  setupToolHandlers(server, ctx);

  process.on("SIGINT", () => {
    void server.close().then(() => {
      process.exit(0);
    });
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Cardano MCP server running on stdio");
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : "Unknown error";
  console.error("Failed to run server:", msg);
  process.exit(1);
});
