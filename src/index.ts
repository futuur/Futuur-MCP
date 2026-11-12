#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { createServer } from "./server.js";

// stdout carries the protocol; anything for humans goes to stderr.
serveStdio(createServer);
