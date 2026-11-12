// Builds the Claude Desktop extension (futuur.mcpb): the compiled server, its production
// dependencies, the manifest and the icon. Run `npm run mcpb` (builds first).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const stage = join(root, "dist", "mcpb");
const output = join(root, "dist", "futuur.mcpb");
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

if (!existsSync(join(root, "build", "index.js"))) throw new Error("build/ is missing: run `npm run build` first");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
if (manifest.version !== pkg.version) throw new Error(`manifest.json is ${manifest.version} but package.json is ${pkg.version}`);

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, "build"), join(stage, "build"), { recursive: true });
for (const file of ["manifest.json", "package.json", "package-lock.json"]) cpSync(join(root, file), join(stage, file));
cpSync(join(root, "assets", "icon.png"), join(stage, "icon.png"));

run("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], stage);
run("npx", ["-y", "@anthropic-ai/mcpb@2.1.2", "validate", "manifest.json"], stage);
run("npx", ["-y", "@anthropic-ai/mcpb@2.1.2", "pack", ".", output], stage);
console.log(`\nBuilt ${output}`);
