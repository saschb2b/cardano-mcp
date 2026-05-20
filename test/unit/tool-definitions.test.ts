import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS } from "../../src/tool-definitions.js";

describe("TOOL_DEFINITIONS", () => {
  it("has unique tool names", () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every tool has a non-empty description (the AI reads this)", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(
        tool.description.length,
        tool.name + " description",
      ).toBeGreaterThan(30);
    }
  });

  it("every tool has a JSON-Schema inputSchema with type:object", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }
  });

  it("every tool declares a category", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.category, `${tool.name} category`).toBeTruthy();
    }
  });
});
