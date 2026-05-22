#!/usr/bin/env node
import { MCPServer } from "mcp-framework";
import { configureFutuurApi } from "./utils/api.js";

configureFutuurApi({
  publicKey: process.env.FUTUUR_PUBLIC_KEY,
  privateKey: process.env.FUTUUR_PRIVATE_KEY,
});

const server = new MCPServer({
  name: "Futuur API Integration",
  version: "1.0.0",
});

server.start();
