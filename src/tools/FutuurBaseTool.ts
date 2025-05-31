import { MCPTool } from "mcp-framework";

/**
 * Base class for all Futuur API tools
 * 
 * Previously applied authentication patches, but now authentication is built
 * directly into the fetchFromFutuur helper function for reliability.
 * All tools that interact with Futuur endpoints should extend this class.
 */
export abstract class FutuurBaseTool<I extends Record<string, any>> extends MCPTool<I> {
  // Base implementation - child classes implement their specific logic
} 