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

test('adds a token once, scans every matching address, and applies an automatic DEX quote', async () => {
  const contract = '0x1111111111111111111111111111111111111111';
  const mock = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === `/token-pairs/v1/bsc/${contract}`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify([
        { baseToken: { address: contract }, priceUsd: '1.50', liquidity: { usd: 1000 }, priceChange: { h24: 1 }, dexId: 'low-liquidity' },
        { baseToken: { address: '0x9999999999999999999999999999999999999999' }, quoteToken: { address: contract }, priceUsd: '8', priceNative: '4', liquidity: { usd: 100000 }, priceChange: { h24: 5 }, dexId: 'best-liquidity', url: 'https://dex.example/pair' }
      ]));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = rpc.method === 'eth_call' ? '0x56bc75e2d63100000' : '0x0';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mockPort = await listen(mock);
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-token-'));
  const appPort = 45000 + (process.pid % 1000);
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
    const addedAddress = await request(url, '/api/addresses', {
      method: 'POST', cookie, csrf,
      body: { phoneId: 'P-02', wallet: 1, chain: 'BNB Chain', address: '0x2222222222222222222222222222222222222222' }
    });
    assert.equal(addedAddress.response.status, 200);
    const secondAddress = addedAddress.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x2222'));
    const initialNextSync = Date.parse(secondAddress.nextSyncAt);
    assert.ok(initialNextSync >= Date.now() + 10 * 60 * 60 * 1000 - 60_000);
    assert.ok(initialNextSync <= Date.now() + 24 * 60 * 60 * 1000 + 60_000);

    const addedToken = await request(url, '/api/tokens', {
      method: 'POST', cookie, csrf,
      body: { chain: 'BNB Chain', contract, symbol: 'TEST', name: 'Test Token', decimals: 18, price: '' }
    });
    assert.equal(addedToken.response.status, 200);
    const token = addedToken.payload.customTokens.find(item => item.contract === contract);
    assert.equal(token.scope, 'all');
    assert.equal(token.priceMode, 'auto');
    assert.equal('addressId' in token, false);

    const synced = await request(url, '/api/sync', {
      method: 'POST', cookie, csrf,
      body: { scope: 'addressIds', addressIds: ['AD-001', secondAddress.id] }
    });
    assert.equal(synced.response.status, 200);
    const rescheduledAddress = synced.payload.addresses.find(item => item.id === secondAddress.id);
    const rescheduledAt = Date.parse(rescheduledAddress.nextSyncAt);
    assert.ok(rescheduledAt >= Date.now() + 10 * 60 * 60 * 1000 - 60_000);
    assert.ok(rescheduledAt <= Date.now() + 24 * 60 * 60 * 1000 + 60_000);
    assert.notEqual(rescheduledAt, initialNextSync);
    const syncedToken = synced.payload.customTokens.find(item => item.id === token.id);
    assert.equal(syncedToken.scannedAddressCount, 2);
    assert.equal(syncedToken.holderCount, 2);
    assert.equal(syncedToken.price, 2);
    assert.equal(syncedToken.change24, null);
    assert.equal(syncedToken.quoteSource, 'dexscreener');
    assert.equal(syncedToken.quoteUrl, 'https://dex.example/pair');
    const tokenAssets = synced.payload.assets.filter(asset => asset.customTokenId === token.id);
    assert.equal(tokenAssets.length, 2);
    assert.deepEqual(tokenAssets.map(asset => asset.value).sort((a, b) => a - b), [200, 200]);
    assert.ok(tokenAssets.every(asset => asset.priceSource === 'dexscreener'));
    assert.ok(Array.isArray(synced.payload.netWorthHistory));
    const latestSnapshot = synced.payload.netWorthHistory.at(-1);
    const expectedTotal = synced.payload.assets.reduce((sum, asset) => sum + (Number.isFinite(Number(asset.value)) ? Number(asset.value) : 0), 0);
    assert.equal(latestSnapshot.total, expectedTotal);
    assert.ok(Date.now() - latestSnapshot.timestamp < 10_000);
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise(resolve => mock.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test('values the official X Layer USDG contract when the market quote is unavailable', async () => {
  const contract = '0x4ae46a509F6b1D9056937BA4500cb143933D2dc8';
  const rawBalance = 123_456_000n;
  const mock = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === `/token-pairs/v1/xlayer/${contract}`) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('[]');
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const result = rpc.method === 'eth_call' ? `0x${rawBalance.toString(16)}` : '0x0';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mockPort = await listen(mock);
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-usdg-'));
  const appPort = 46000 + (process.pid % 1000);
  const url = `http://127.0.0.1:${appPort}`;
  const password = 'AdminPassword-123';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(appPort), DATA_ROOT: dataRoot, COOKIE_SECURE: 'false',
      SESSION_SECRET: 'integration-test-session-secret-32-characters', INITIAL_ADMIN_USERNAME: 'chainfolio',
      INITIAL_ADMIN_PASSWORD_HASH: passwordHash(password), XLAYER_RPC_URL: `http://127.0.0.1:${mockPort}`,
      DEX_SCREENER_BASE_URL: `http://127.0.0.1:${mockPort}`, DISABLE_MARKET_PRICES: 'true'
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(url);
    const login = await request(url, '/api/auth/login', { method: 'POST', body: { username: 'chainfolio', password } });
    const cookie = login.cookie; const csrf = login.payload.csrfToken;
    const addedAddress = await request(url, '/api/addresses', {
      method: 'POST', cookie, csrf,
      body: { phoneId: 'P-02', wallet: 1, chain: 'X Layer', address: '0x3333333333333333333333333333333333333333' }
    });
    assert.equal(addedAddress.response.status, 200);
    const address = addedAddress.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x3333'));

    const addedToken = await request(url, '/api/tokens', {
      method: 'POST', cookie, csrf,
      body: { chain: 'X Layer', contract, symbol: 'USDG', name: 'Global Dollar', decimals: 6, price: '' }
    });
    assert.equal(addedToken.response.status, 200);
    const token = addedToken.payload.customTokens.find(item => item.contract.toLowerCase() === contract.toLowerCase());

    const synced = await request(url, '/api/sync', {
      method: 'POST', cookie, csrf,
      body: { scope: 'addressIds', addressIds: [address.id] }
    });
    assert.equal(synced.response.status, 200);
    const syncedToken = synced.payload.customTokens.find(item => item.id === token.id);
    assert.equal(syncedToken.price, 1);
    assert.equal(syncedToken.quoteSource, 'stablecoin-fallback');
    assert.equal(syncedToken.quoteError, null);
    const asset = synced.payload.assets.find(item => item.customTokenId === token.id && item.addressId === address.id);
    assert.equal(asset.amount, '123.456 USDG');
    assert.equal(asset.value, 123.456);
    assert.equal(asset.priceSource, 'stablecoin-fallback');
    assert.ok(synced.payload.netWorthHistory.at(-1).total >= 123.456);
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise(resolve => mock.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  }
});

test('tracks X Layer xETH and BNB Chain wrapped ETH globally using the ETH reference price', async () => {
  const xethContract = '0xe7b000003a45145decf8a28fc755ad5ec5ea025a';
  const bnbWethContract = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8';
  const xethBalance = 2n * 10n ** 18n;
  const bnbWethBalance = 5n * 10n ** 17n;
  const mock = createServer(async (request, response) => {
    if (request.method === 'GET' && request.url?.startsWith('/api/v3/simple/price?')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        ethereum: { usd: 3200, usd_24h_change: 2.5 },
        binancecoin: { usd: 600 },
        okb: { usd: 50 },
        solana: { usd: 100 }
      }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rpc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    let result = '0x0';
    if (rpc.method === 'alchemy_getTokenBalances') result = { tokenBalances: [] };
    if (rpc.method === 'eth_getLogs') result = [];
    if (rpc.method === 'eth_call') {
      const contract = String(rpc.params?.[0]?.to || '').toLowerCase();
      if (contract === xethContract.toLowerCase()) result = `0x${xethBalance.toString(16)}`;
      if (contract === bnbWethContract.toLowerCase()) result = `0x${bnbWethBalance.toString(16)}`;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  });
  const mockPort = await listen(mock);
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-wrapped-eth-'));
  const appPort = 46500 + (process.pid % 1000);
  const url = `http://127.0.0.1:${appPort}`;
  const password = 'AdminPassword-123';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      HOST: '127.0.0.1', PORT: String(appPort), DATA_ROOT: dataRoot, COOKIE_SECURE: 'false',
      SESSION_SECRET: 'integration-test-session-secret-32-characters', INITIAL_ADMIN_USERNAME: 'chainfolio',
      INITIAL_ADMIN_PASSWORD_HASH: passwordHash(password), BNB_RPC_URL: `http://127.0.0.1:${mockPort}`,
      XLAYER_RPC_URL: `http://127.0.0.1:${mockPort}`, COINGECKO_API_BASE: `http://127.0.0.1:${mockPort}/api/v3`,
      DEX_SCREENER_BASE_URL: `http://127.0.0.1:${mockPort}`
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(url);
    const login = await request(url, '/api/auth/login', { method: 'POST', body: { username: 'chainfolio', password } });
    const cookie = login.cookie; const csrf = login.payload.csrfToken;
    const withBnb = await request(url, '/api/addresses', {
      method: 'POST', cookie, csrf,
      body: { phoneId: 'P-02', wallet: 1, chain: 'BNB Chain', address: '0x4444444444444444444444444444444444444444' }
    });
    const bnbAddress = withBnb.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x4444'));
    const withXLayer = await request(url, '/api/addresses', {
      method: 'POST', cookie, csrf,
      body: { phoneId: 'P-02', wallet: 2, chain: 'X Layer', address: '0x5555555555555555555555555555555555555555' }
    });
    const xlayerAddress = withXLayer.payload.addresses.find(item => item.address.toLowerCase().startsWith('0x5555'));
    const synced = await request(url, '/api/sync', {
      method: 'POST', cookie, csrf,
      body: { scope: 'addressIds', addressIds: [bnbAddress.id, xlayerAddress.id] }
    });
    assert.equal(synced.response.status, 200);
    const xethToken = synced.payload.customTokens.find(item => item.contract.toLowerCase() === xethContract.toLowerCase());
    const bnbWethToken = synced.payload.customTokens.find(item => item.contract.toLowerCase() === bnbWethContract.toLowerCase());
    assert.equal(xethToken.system, true);
    assert.equal(bnbWethToken.system, true);
    assert.equal(xethToken.quoteSource, 'wrapped-native-fallback');
    assert.equal(bnbWethToken.quoteSource, 'wrapped-native-fallback');
    const xethAsset = synced.payload.assets.find(item => item.customTokenId === xethToken.id && item.addressId === xlayerAddress.id);
    const bnbWethAsset = synced.payload.assets.find(item => item.customTokenId === bnbWethToken.id && item.addressId === bnbAddress.id);
    assert.equal(xethAsset.amount, '2 XETH');
    assert.equal(xethAsset.value, 6400);
    assert.equal(xethAsset.priceSource, 'wrapped-native-fallback');
    assert.equal(bnbWethAsset.amount, '0.5 ETH');
    assert.equal(bnbWethAsset.value, 1600);
    assert.equal(bnbWethAsset.priceSource, 'wrapped-native-fallback');
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await new Promise(resolve => mock.close(resolve));
    await rm(dataRoot, { recursive: true, force: true });
  }
});
