import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { FutuurApiError } from "./api.js";

/** Tool only reads data from the Futuur API. */
export const READ = { readOnlyHint: true, openWorldHint: true } as const;
/** Tool spends, sells or cancels on the user's account: clients should ask before running it. */
export const WRITE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true } as const;

/** Raised by a handler for a problem the model or user can fix (bad combination of inputs, etc.). */
export class ToolInputError extends Error {}

export interface ToolDef<Shape extends z.ZodRawShape = z.ZodRawShape> {
  /** snake_case tool name, stable across releases. */
  name: string;
  /** Short human-readable name shown in client UIs. */
  title: string;
  /** What it does, when to use it, and what it returns. Written for the model. */
  description: string;
  /** Zod shape of the arguments; every field needs `.describe()`. */
  input: Shape;
  annotations: typeof READ | typeof WRITE;
  /** Returns the JSON-serialisable result. Throw to report an error. */
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>;
}

/** Identity helper that infers the handler's argument types from `input`. */
export function defineTool<Shape extends z.ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> {
  return def;
}

export function errorText(error: unknown): string {
  if (error instanceof FutuurApiError || error instanceof ToolInputError) return error.message;
  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}

/** Runs a tool the way the server does: JSON text plus structured content, or an `isError` result. */
export async function runTool(def: ToolDef<any>, args: unknown) {
  try {
    const result = await def.handler(args as any);
    const structured =
      result !== null && typeof result === "object" && !Array.isArray(result)
        ? (result as Record<string, unknown>)
        : { result };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: structured,
    };
  } catch (error) {
    return { content: [{ type: "text" as const, text: errorText(error) }], isError: true };
  }
}

export function registerTools(server: McpServer, tools: ToolDef<any>[]): void {
  for (const def of tools) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: z.object(def.input),
        annotations: { title: def.title, ...def.annotations },
      },
      (args: unknown) => runTool(def, args),
    );
  }
}
