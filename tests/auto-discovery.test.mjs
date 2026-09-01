import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { randomBytes, scryptSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function passwordHash(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function listen(server) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(`${url}/api/healthz`)).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('test server did not start');
}

async function request(url, path, { method = 'GET', body, cookie, csrf } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  if (csrf) headers['x-csrf-token'] = csrf;
  const response = await fetch(`${url}${path}`, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  return { response, payload, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

function staticAbiString(value) {
  return `0x${Buffer.from(value).toString('hex').padEnd(64, '0')}`;
}

test('discovers an ERC-20 balance through an indexer-capable RPC and keeps system stablecoins global', async () => {
  const contract = '0x4444444444444444444444444444444444444444';
  const rawBalance = 21n * 10n ** 18n;
  const mock = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === `/token-pairs/v1/bsc/${contract}`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([{ baseToken: { address: contract }, priceUsd: '2', liquidity: { usd: 1000 }, priceChange: { h24: 3 }, dexId: 'test-dex', url: 'https://dex.example/auto' }]));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let result = '0x0';
    if (rpc.method === 'eth_getBalance') result = '0x0';
    if (rpc.method === 'alchemy_getTokenBalances') result = { tokenBalances: [{ contractAddress: contract, tokenBalance: `0x${rawBalance.toString(16)}` }] };
    if (rpc.method === 'eth_call') {
      const data = String(rpc.params?.[0]?.data || '');
      if (data.startsWith('0x313ce567')) result = '0x12';
      else if (data.startsWith('0x95d89b41')) result = staticAbiString('AUTO');
      else if (data.startsWith('0x06fdde03')) result = staticAbiString('Auto Token');
      else if (data.startsWith('0x70a08231')) result = `0x${rawBalance.toString(16)}`;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mockPort = await listen(mock);
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-discovery-'));
  const appPort = 47000 + (process.pid % 1000);
  const url = `http://127.0.0.1:${appPort}`;
  const password = 'AdminPassword-123';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(appPort), DATA_ROOT: dataRoot, COOKIE_SECURE: 'false',
      SESSION_SECRET: 'integration-test-session-secret-32-characters', INITIAL_ADMIN_USERNAME: 'chainfolio',
      INITIAL_ADMIN_PASSWORD_HASH: passwordHash(password), BNB_RPC_URL: `http://127.0.0.1:${mockPort}`,
      DEX_SCREENER_BASE_URL: `http://127.0.0.1:${mockPort}`, DISABLE_MARKET_PRICES: 'true'
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(url);
    const login = await request(url, '/api/auth/login', { method: 'POST', body: { username: 'chainfolio', password } });
    const cookie = login.cookie; const csrf = login.payload.csrfToken;
    const added = await request(url, '/api/addresses', { method: 'POST', cookie, csrf, body: { phoneId: 'P-02', wallet: 1, chain: 'BNB Chain', address: '0x5555555555555555555555555555555555555555' } });
    assert.equal(added.response.status, 200);
    const address = added.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x5555'));
    const systemUsdt = added.payload.customTokens.find(item => item.chain === 'BNB Chain' && item.symbol === 'USDT');
    assert.equal(systemUsdt.system, true);
    const synced = await request(url, '/api/sync', { method: 'POST', cookie, csrf, body: { scope: 'addressIds', addressIds: [address.id] } });
    assert.equal(synced.response.status, 200);
    const discovered = synced.payload.assets.find(item => item.source === 'auto-discovery' && item.tokenAddress?.toLowerCase() === contract);
    assert.equal(discovered.symbol, 'AUTO');
    assert.equal(discovered.value, 42);
    assert.equal(discovered.priceSource, 'dexscreener');
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise(resolve => mock.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test('uses an indexed explorer response when the RPC has no token index method', async () => {
  const contract = '0x6666666666666666666666666666666666666666';
  const rawBalance = 1234n * 10n ** 6n;
  const mock = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url?.startsWith('/v2/api?')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: '1', message: 'OK', result: [{ TokenAddress: contract, TokenName: 'Indexed Token', TokenSymbol: 'IDX', TokenQuantity: String(rawBalance), TokenDivisor: '6', TokenPriceUSD: '1.25' }] }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let result = '0x0';
    if (rpc.method === 'eth_getBalance') result = '0x0';
    if (rpc.method === 'eth_getLogs') result = [];
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mockPort = await listen(mock);
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-explorer-'));
  const appPort = 47100 + (process.pid % 1000);
  const url = `http://127.0.0.1:${appPort}`;
  const password = 'AdminPassword-123';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(appPort), DATA_ROOT: dataRoot, COOKIE_SECURE: 'false',
      SESSION_SECRET: 'integration-test-session-secret-32-characters', INITIAL_ADMIN_USERNAME: 'chainfolio',
      INITIAL_ADMIN_PASSWORD_HASH: passwordHash(password), ETHEREUM_RPC_URL: `http://127.0.0.1:${mockPort}`,
      ETHERSCAN_API_KEY: 'test-key', ETHERSCAN_API_BASE: `http://127.0.0.1:${mockPort}/v2/api`, DISABLE_MARKET_PRICES: 'true'
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(url);
    const login = await request(url, '/api/auth/login', { method: 'POST', body: { username: 'chainfolio', password } });
    const cookie = login.cookie; const csrf = login.payload.csrfToken;
    const added = await request(url, '/api/addresses', { method: 'POST', cookie, csrf, body: { phoneId: 'P-02', wallet: 1, chain: 'Ethereum', address: '0x7777777777777777777777777777777777777777' } });
    assert.equal(added.response.status, 200);
    const address = added.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x7777'));
    const synced = await request(url, '/api/sync', { method: 'POST', cookie, csrf, body: { scope: 'addressIds', addressIds: [address.id] } });
    assert.equal(synced.response.status, 200);
    const discovered = synced.payload.assets.find(item => item.source === 'auto-discovery' && item.tokenAddress?.toLowerCase() === contract);
    assert.equal(discovered.symbol, 'IDX');
    assert.equal(discovered.value, 1542.5);
    assert.equal(discovered.priceSource, 'etherscan');
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise(resolve => mock.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  }
});
