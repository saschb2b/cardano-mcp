import { describe, expect, it } from "vitest";
import { ServerContext } from "../../src/context.js";
import { TOOL_DEFINITIONS } from "../../src/tool-definitions.js";

/**
 * Smoke test for the filtering rules used by `setupToolHandlers`. We don't
 * mount the MCP server here — just verify that the filter functions
 * applied inside the router behave correctly for `toolsets`,
 * `excludeTools`, and `readOnly`.
 */
function activeTools(ctx: ServerContext) {
  return TOOL_DEFINITIONS.filter((tool) => {
    if (ctx.toolsets && !ctx.toolsets.has(tool.category)) return false;
    if (ctx.excludeTools.has(tool.name)) return false;
    if (ctx.readOnly && !tool.readOnly) return false;
    return true;
  });
}

describe("tool filtering", () => {
  it("returns all tools when no filters applied", () => {
    const ctx = new ServerContext({});
    expect(activeTools(ctx).length).toBe(TOOL_DEFINITIONS.length);
  });

  it("respects toolsets filter", () => {
    const ctx = new ServerContext({ toolsets: ["chain"] });
    const tools = activeTools(ctx);
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.category === "chain")).toBe(true);
  });

  it("respects excludeTools filter", () => {
    const ctx = new ServerContext({ excludeTools: ["lookup_cip"] });
    expect(
      activeTools(ctx).find((t) => t.name === "lookup_cip"),
    ).toBeUndefined();
  });

  it("readOnly keeps tools because all are read-only", () => {
    const ctx = new ServerContext({ readOnly: true });
    expect(activeTools(ctx).length).toBe(TOOL_DEFINITIONS.length);
  });
});
