import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext } from "./context.js";
import { logDebug } from "./utils.js";
import { TOOL_DEFINITIONS, type ToolDefinition } from "./tool-definitions.js";
import * as chainHandlers from "./handlers/chain-handlers.js";
import * as cipHandlers from "./handlers/cip-handlers.js";
import * as handleHandlers from "./handlers/handle-handlers.js";
import * as datumHandlers from "./handlers/datum-handlers.js";
import * as feeHandlers from "./handlers/fee-handlers.js";

type HandlerFn = (ctx: ServerContext, args: any) => any;

const HANDLER_MAP: Record<string, HandlerFn> = {
  // chain
  get_address_balance: chainHandlers.handleGetAddressBalance,
  get_address_utxos: chainHandlers.handleGetAddressUtxos,
  get_address_transactions: chainHandlers.handleGetAddressTransactions,
  get_asset_metadata: chainHandlers.handleGetAssetMetadata,

  // cip
  lookup_cip: cipHandlers.handleLookupCip,

  // handle
  resolve_ada_handle: handleHandlers.handleResolveAdaHandle,

  // datum
  get_datum: datumHandlers.handleGetDatum,

  // fees
  estimate_tx_fees: feeHandlers.handleEstimateTxFees,
};

function getActiveTools(ctx: ServerContext): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((tool) => {
    if (ctx.toolsets && !ctx.toolsets.has(tool.category)) return false;
    if (ctx.excludeTools.has(tool.name)) return false;
    if (ctx.readOnly && !tool.readOnly) return false;
    return true;
  });
}

function toMcpTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: {
      title: tool.name.replace(/_/g, " "),
      readOnlyHint: tool.readOnly,
      destructiveHint: tool.destructive ?? false,
      idempotentHint: tool.readOnly,
      openWorldHint: true,
    },
  };
}

export function setupToolHandlers(server: Server, ctx: ServerContext): void {
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: getActiveTools(ctx).map(toMcpTool),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    logDebug(ctx.debugMode, `Handling tool request: ${toolName}`);

    const handler = HANDLER_MAP[toolName];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    const activeTool = getActiveTools(ctx).find((t) => t.name === toolName);
    if (!activeTool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool "${toolName}" is not available with current configuration (toolsets/exclude/readOnly filters applied)`,
      );
    }

    return await handler(ctx, request.params.arguments);
  });
}
