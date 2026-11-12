import { createRequire } from "node:module";

/** The package version, read from package.json so there is one place to bump it. */
export const VERSION: string = createRequire(import.meta.url)("../package.json").version;
