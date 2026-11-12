import type { ToolDef } from "../tool.js";
import { accountTools } from "./account.js";
import { marketTools } from "./markets.js";
import { positionTools } from "./positions.js";
import { tradingTools } from "./trading.js";

export const allTools: ToolDef<any>[] = [...marketTools, ...accountTools, ...tradingTools, ...positionTools];
