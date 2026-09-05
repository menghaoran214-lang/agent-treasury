import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { app } from './demoServer.js';
import { server as mcpServer } from '../mcp/server.js';
import { binanceAgenticWalletAdapter } from '../adapters/walletAdapter.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const uiDist = join(root, 'apps', 'demo-ui', 'dist');
const port = parseInt(process.env.TREASURY_PORT || process.env.DEMO_PORT || '3333', 10);
let transport: StreamableHTTPServerTransport | null = null;
let activeSessionId: string | null = null;

app.post('/mcp', async (req, res) => {
  try {
    const requestedSession = req.headers['mcp-session-id'];
    if (!transport && !requestedSession && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: randomUUID,
        onsessioninitialized: sessionId => { activeSessionId = sessionId; },
      });
      await mcpServer.connect(transport);
    }
    if (!transport || (requestedSession && requestedSession !== activeSessionId)) {
      res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null });
      return;
    }
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'MCP request failed' }, id: null });
  }
});

app.get('/api/runtime/status', async (_req, res) => {
  const wallet = await binanceAgenticWalletAdapter.getStatus?.();
  res.json({
    service: 'agent-treasury', status: 'ok', pid: process.pid,
    components: { api: 'ready', mcp: 'ready', database: 'ready', ui: existsSync(uiDist) ? 'ready' : 'not_built' },
    payment_mode: process.env.TREASURY_PAYMENT_MODE || 'mock',
    wallet: wallet ?? { state: 'unknown' },
  });
});

if (existsSync(uiDist)) {
  app.use(express.static(uiDist));
  app.get(/^(?!\/api|\/mcp|\/health).*/, (_req, res) => res.sendFile(join(uiDist, 'index.html')));
}

createServer(app).listen(port, () => {
  console.log(`Agent Treasury service: http://127.0.0.1:${port}`);
  console.log(`MCP endpoint: http://127.0.0.1:${port}/mcp`);
});
