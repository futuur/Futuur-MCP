import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { allTools } from "../src/tools/index.js";
import { VERSION } from "../src/version.js";

const read = (file: string) => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const pkg = read("package.json");
const server = read("server.json");
const manifest = read("manifest.json");

describe("published metadata stays in step with the package", () => {
  it("uses one version everywhere", () => {
    expect(VERSION).toBe(pkg.version);
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0].version).toBe(pkg.version);
    expect(manifest.version).toBe(pkg.version);
  });

  it("meets the MCP registry rules", () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(server.name).toMatch(/^io\.github\.futuur\/[a-zA-Z0-9._-]+$/);
    expect(server.description.length).toBeLessThanOrEqual(100);
    expect(server.packages[0].identifier).toBe(pkg.name);
  });

  it("lists every tool in the extension manifest", () => {
    expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(allTools.map((t) => t.name).sort());
  });

  it("declares the same environment variables in both manifests", () => {
    const registryVars = server.packages[0].environmentVariables.map((v: { name: string }) => v.name).sort();
    expect(Object.keys(manifest.server.mcp_config.env).sort()).toEqual(registryVars);
  });
});
