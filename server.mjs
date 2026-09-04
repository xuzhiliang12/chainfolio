import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const projectRoot = new URL('.', import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, value => value.slice(1));
const publicRoot = join(projectRoot, 'public');
const dataRoot = process.env.DATA_ROOT ? resolve(process.env.DATA_ROOT) : join(projectRoot, 'data');
const stateFile = join(dataRoot, 'state.json');
const tempStateFile = join(dataRoot, 'state.tmp.json');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const appVersion = String(process.env.APP_VERSION || 'dev');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const CONCURRENCY_PER_CHAIN = 3;
const RANDOM_REFRESH_MIN_HOURS = 10;
const RANDOM_REFRESH_MAX_HOURS = 24;
const RANDOM_CHECK_MIN_MINUTES = 12;
const RANDOM_CHECK_MAX_MINUTES = 37;
const RANDOM_BATCH_MAX_ADDRESSES = 8;
const TOKEN_DISCOVERY_MAX_TOKENS = Math.min(1_000, Math.max(10, Number(process.env.TOKEN_DISCOVERY_MAX_TOKENS) || 250));
const TOKEN_DISCOVERY_HISTORY_BLOCKS = Math.min(5_000_000, Math.max(10_000, Number(process.env.TOKEN_DISCOVERY_HISTORY_BLOCKS) || 500_000));
const TOKEN_DISCOVERY_LOG_CHUNK = Math.min(100_000, Math.max(5_000, Number(process.env.TOKEN_DISCOVERY_LOG_CHUNK) || 50_000));
const TOKEN_DISCOVERY_FULL_HISTORY = process.env.TOKEN_DISCOVERY_FULL_HISTORY === 'true';
const TOKEN_DISCOVERY_MAX_LOGS = Math.min(100_000, Math.max(100, Number(process.env.TOKEN_DISCOVERY_MAX_LOGS) || 20_000));
const TOKEN_DISCOVERY_MIN_LOG_CHUNK = 1_000;
const ETHERSCAN_API_KEY = String(process.env.ETHERSCAN_API_KEY || '').trim();
const ETHERSCAN_API_BASE = String(process.env.ETHERSCAN_API_BASE || 'https://api.etherscan.io/v2/api').trim();
const COINGECKO_API_BASE = String(process.env.COINGECKO_API_BASE || 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
const TOKEN_INDEXER_TIMEOUT_MS = Math.min(30_000, Math.max(3_000, Number(process.env.TOKEN_INDEXER_TIMEOUT_MS) || 12_000));
const SESSION_MAX_AGE = 7 * 24 * HOUR;
const scryptAsync = promisify(scrypt);

function randomRefreshAt(from = Date.now()) {
  const minutes = randomInt(RANDOM_REFRESH_MIN_HOURS * 60, RANDOM_REFRESH_MAX_HOURS * 60 + 1);
  return new Date(from + minutes * MINUTE + randomInt(0, 60_000)).toISOString();
}

function randomCheckDelay() {
  return randomInt(RANDOM_CHECK_MIN_MINUTES, RANDOM_CHECK_MAX_MINUTES + 1) * MINUTE + randomInt(0, 60_000);
}

function shuffled(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(0, index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function nextAddressSchedule(addresses, fallback = null) {
  const times = addresses.map(item => Date.parse(item.nextSyncAt)).filter(Number.isFinite);
  return times.length ? new Date(Math.min(...times)).toISOString() : fallback;
}

function nextBatchSchedule(addresses, nextCheckAt = null) {
  const earliest = nextAddressSchedule(addresses, nextCheckAt);
  return earliest && Date.parse(earliest) <= Date.now() && nextCheckAt ? nextCheckAt : earliest;
}

const networkCatalog = [
  { name: 'Ethereum', symbol: 'ETH', type: 'EVM', decimals: 18, chainId: '1', blockscoutApi: process.env.ETHEREUM_BLOCKSCOUT_API || 'https://eth.blockscout.com/api/v2', rpc: process.env.ETHEREUM_RPC_URL || ['https://cloudflare-eth.com', 'https://ethereum-rpc.publicnode.com'], priceId: 'ethereum', dexScreenerId: 'ethereum' },
  { name: 'Solana', symbol: 'SOL', type: 'SVM', decimals: 9, rpc: process.env.SOLANA_RPC_URL || ['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'], priceId: 'solana', dexScreenerId: 'solana' },
  { name: 'Arbitrum', symbol: 'ETH', type: 'EVM', decimals: 18, chainId: '42161', blockscoutApi: process.env.ARBITRUM_BLOCKSCOUT_API || 'https://arbitrum.blockscout.com/api/v2', rpc: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc', priceId: 'ethereum', dexScreenerId: 'arbitrum' },
  { name: 'Base', symbol: 'ETH', type: 'EVM', decimals: 18, chainId: '8453', blockscoutApi: process.env.BASE_BLOCKSCOUT_API || 'https://base.blockscout.com/api/v2', rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org', priceId: 'ethereum', dexScreenerId: 'base' },
  { name: 'Optimism', symbol: 'ETH', type: 'EVM', decimals: 18, chainId: '10', blockscoutApi: process.env.OPTIMISM_BLOCKSCOUT_API || 'https://optimism.blockscout.com/api/v2', rpc: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io', priceId: 'ethereum', dexScreenerId: 'optimism' },
  { name: 'BNB Chain', symbol: 'BNB', type: 'EVM', decimals: 18, chainId: '56', rpc: process.env.BNB_RPC_URL || 'https://bsc-dataseed.bnbchain.org', priceId: 'binancecoin', dexScreenerId: 'bsc' },
  { name: 'Robinhood Chain', symbol: 'ETH', type: 'EVM', decimals: 18, chainId: '4663', blockscoutApi: process.env.ROBINHOOD_BLOCKSCOUT_API || 'https://robinhoodchain.blockscout.com/api/v2', rpc: process.env.ROBINHOOD_RPC_URL || 'https://rpc.mainnet.chain.robinhood.com', priceId: 'ethereum', dexScreenerId: null },
  { name: 'X Layer', symbol: 'OKB', type: 'EVM', decimals: 18, chainId: '196', rpc: process.env.XLAYER_RPC_URL || 'https://rpc.xlayer.tech', priceId: 'okb', dexScreenerId: 'xlayer' }
];

// The catalog is intentionally limited to deployments whose contract/mint is known.
// Unsupported chain/token combinations are not guessed: users can still add them as
// custom tokens when they have verified the address themselves.
const stablecoinCatalog = [
  { chain: 'Ethereum', symbol: 'USDT', name: 'Tether USD', decimals: 6, contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', url: 'https://tether.to/en/supported-protocols/' },
  { chain: 'Ethereum', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'Ethereum', symbol: 'USDG', name: 'Global Dollar', decimals: 6, contract: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D', url: 'https://docs.paxos.com/guides/stablecoin/usdg/mainnet' },
  { chain: 'Arbitrum', symbol: 'USDT', name: 'Tether USD (USDT0)', decimals: 6, contract: '0xFd086bC7CD5C481dcc9C85ebe478A1C0b69FCbb9', url: 'https://docs.usdt0.to/technical-documentation/developer/' },
  { chain: 'Arbitrum', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'Arbitrum', symbol: 'USDG', name: 'Global Dollar', decimals: 6, contract: '0x004B506865409877C9fA29bfb1ebA929984B9bbC', url: 'https://docs.paxos.com/guides/stablecoin/usdg/mainnet' },
  { chain: 'Base', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'Optimism', symbol: 'USDT', name: 'Tether USD', decimals: 6, contract: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', url: 'https://tether.to/en/supported-protocols/' },
  { chain: 'Optimism', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'BNB Chain', symbol: 'USDT', name: 'Tether USD (BEP-20)', decimals: 18, contract: '0x55d398326f99059fF775485246999027B3197955', url: 'https://tether.to/en/supported-protocols/' },
  { chain: 'BNB Chain', symbol: 'USDC', name: 'USD Coin (Binance-Peg)', decimals: 18, contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', url: 'https://www.bnbchain.org/en/assets' },
  { chain: 'Solana', symbol: 'USDT', name: 'Tether USD', decimals: 6, contract: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', url: 'https://tether.to/en/supported-protocols/' },
  { chain: 'Solana', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'Solana', symbol: 'USDG', name: 'Global Dollar', decimals: 6, contract: '2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH', url: 'https://docs.paxos.com/guides/stablecoin/usdg/mainnet' },
  { chain: 'Robinhood Chain', symbol: 'USDG', name: 'Global Dollar', decimals: 6, contract: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168', url: 'https://docs.robinhood.com/chain/contracts/' },
  { chain: 'X Layer', symbol: 'USDT', name: 'Tether USD (USDT0)', decimals: 6, contract: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736', url: 'https://www.okx.com/en-us/help/usdt0-faq' },
  { chain: 'X Layer', symbol: 'USDC', name: 'USD Coin', decimals: 6, contract: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', url: 'https://developers.circle.com/stablecoins/usdc-contract-addresses' },
  { chain: 'X Layer', symbol: 'USDG', name: 'Global Dollar', decimals: 6, contract: '0x4ae46a509F6b1D9056937BA4500cb143933D2dc8', url: 'https://docs.paxos.com/guides/stablecoin/usdg/mainnet' }
];

const wrappedAssetCatalog = [
  {
    chain: 'BNB Chain', symbol: 'ETH', name: 'Binance-Peg Ethereum Token (WETH)', decimals: 18,
    contract: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', priceId: 'ethereum',
    url: 'https://bscscan.com/token/0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
  },
  {
    chain: 'X Layer', symbol: 'XETH', name: 'OKX Wrapped ETH', decimals: 18,
    contract: '0xe7b000003a45145decf8a28fc755ad5ec5ea025a', priceId: 'ethereum',
    url: 'https://www.okx.com/zh-hans/xassets'
  }
];

const AUTO_PRICE_SOURCES = new Set(['dexscreener', 'stablecoin-fallback', 'stablecoin-catalog', 'wrapped-native-fallback']);
const trustedStablecoinFallbacks = new Map(stablecoinCatalog.map(item => [
  `${item.chain.toLowerCase()}|${item.contract.toLowerCase()}`,
  { symbol: item.symbol, price: 1, url: item.url }
]));
const trustedWrappedAssets = new Map(wrappedAssetCatalog.map(item => [
  `${item.chain.toLowerCase()}|${item.contract.toLowerCase()}`,
  item
]));

function systemTokenDefinitions() {
  const stablecoins = stablecoinCatalog.map(item => ({
    id: `SC-${item.chain.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}-${item.symbol}`,
    scope: 'all',
    chain: item.chain,
    contract: item.contract,
    symbol: item.symbol,
    name: item.name,
    decimals: item.decimals,
    priceMode: 'auto',
    manualPrice: null,
    price: null,
    quoteSource: 'stablecoin-fallback',
    status: 'pending',
    system: true,
    category: 'stablecoin',
    source: 'stablecoin-catalog',
    sourceUrl: item.url
  }));
  const wrappedAssets = wrappedAssetCatalog.map(item => ({
    id: `WA-${item.chain.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}-${item.symbol}`,
    scope: 'all',
    chain: item.chain,
    contract: item.contract,
    symbol: item.symbol,
    name: item.name,
    decimals: item.decimals,
    priceMode: 'auto',
    manualPrice: null,
    price: null,
    quoteSource: 'wrapped-native-fallback',
    status: 'pending',
    system: true,
    category: 'wrapped-asset',
    source: 'wrapped-asset-catalog',
    sourceUrl: item.url,
    referencePriceId: item.priceId
  }));
  return [...stablecoins, ...wrappedAssets];
}

function stablecoinDefinition(chain, contract) {
  const normalized = String(contract || '').toLowerCase();
  return stablecoinCatalog.find(item => item.chain === chain && item.contract.toLowerCase() === normalized) || null;
}

function getTrustedStablecoinFallback(network, contract) {
  const definition = trustedStablecoinFallbacks.get(`${String(network?.name || '').toLowerCase()}|${String(contract || '').toLowerCase()}`);
  if (!definition) return null;
  return {
    price: definition.price,
    change24: null,
    liquidityUsd: null,
    source: 'stablecoin-fallback',
    dexId: null,
    pairAddress: null,
    url: definition.url,
    quotedAt: new Date().toISOString(),
    error: null
  };
}

function initialState() {
  const managers = [
    { id: 'M-01', name: '张三', color: '#b8ff62' },
    { id: 'M-02', name: '李四', color: '#9188ff' }
  ];
  const phones = Array.from({ length: 27 }, (_, index) => ({ id: `P-${String(index + 1).padStart(2, '0')}`, name: `手机 ${String(index + 1).padStart(2, '0')}`, managerId: index < 18 ? 'M-01' : 'M-02' }));
  const walletCounts = Object.fromEntries(phones.map(phone => [phone.id, 3]));
  const addresses = [
    { id: 'AD-001', phoneId: 'P-01', wallet: 1, chain: 'BNB Chain', address: '0x4e2aB78fD52C981d9932D85E1A47B1097c03A41d', status: 'ready' },
    { id: 'AD-002', phoneId: 'P-01', wallet: 1, chain: 'Ethereum', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', status: 'ready' },
    { id: 'AD-003', phoneId: 'P-02', wallet: 2, chain: 'Solana', address: 'DTSnLQvMePLQqHnVJ6vAB2NZ6wdxNWpzdrBNN7fAYtM', status: 'ready' },
    { id: 'AD-004', phoneId: 'P-03', wallet: 1, chain: 'Arbitrum', address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', status: 'ready' }
  ];
  const assets = [
    { symbol: 'BNB', name: 'BNB', chain: 'BNB Chain', phoneId: 'P-01', wallet: 1, amount: '98.46 BNB', change: 2.34, value: 66488.12, color: '#f3ba2f', source: 'demo' },
    { symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', phoneId: 'P-01', wallet: 1, amount: '18.426 ETH', change: 3.76, value: 57515.22, color: '#6f7cff', source: 'demo' },
    { symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', phoneId: 'P-01', wallet: 1, amount: '24,580 USDC', change: 0.01, value: 24580, color: '#2775ca', source: 'demo' },
    { symbol: 'SOL', name: 'Solana', chain: 'Solana', phoneId: 'P-02', wallet: 2, amount: '142.84 SOL', change: -1.28, value: 18340.66, color: '#8d6cff', source: 'demo' },
    { symbol: 'USDT', name: 'Tether', chain: 'Arbitrum', phoneId: 'P-03', wallet: 1, amount: '8,240 USDT', change: 0.02, value: 8240, color: '#26a17b', source: 'demo' }
  ];
  const now = Date.now();
  const total = assets.reduce((sum, asset) => sum + (Number.isFinite(Number(asset.value)) ? Number(asset.value) : 0), 0);
  for (const address of addresses) address.nextSyncAt = randomRefreshAt(now);
  return { version: 13, managers, phones, walletCounts, walletNames: {}, walletMetadata: {}, walletActivityTemplates: [], walletActivityStatuses: {}, addresses, customNetworks: [], customTokens: systemTokenDefinitions(), assets, netWorthHistory: [{ timestamp: now, total }], lastSync: now, sync: { status: 'idle', startedAt: null, finishedAt: null, error: null }, scheduler: { mode: 'random', minIntervalHours: RANDOM_REFRESH_MIN_HOURS, maxIntervalHours: RANDOM_REFRESH_MAX_HOURS, concurrencyPerChain: CONCURRENCY_PER_CHAIN, lastBatchAt: null, lastBatchSize: 0, nextBatchAt: nextAddressSchedule(addresses) } };
}

function emptyState() {
  return {
    version: 13,
    managers: [],
    phones: [],
    walletCounts: {},
    walletNames: {},
    walletMetadata: {},
    walletActivityTemplates: [],
    walletActivityStatuses: {},
    addresses: [],
    customNetworks: [],
    customTokens: systemTokenDefinitions(),
    assets: [],
    netWorthHistory: [],
    lastSync: Date.now(),
    sync: { status: 'idle', startedAt: null, finishedAt: null, error: null },
    scheduler: { mode: 'random', minIntervalHours: RANDOM_REFRESH_MIN_HOURS, maxIntervalHours: RANDOM_REFRESH_MAX_HOURS, concurrencyPerChain: CONCURRENCY_PER_CHAIN, lastBatchAt: null, lastBatchSize: 0, nextBatchAt: null }
  };
}

const ACTIVITY_FIELD_TYPES = new Set(['select', 'checkbox', 'date', 'text', 'number']);
const LEGACY_ACTIVITY_OPTIONS = [
  { id: 'unset', label: '未登记', role: 'none' },
  { id: 'not_joined', label: '未参加', role: 'none' },
  { id: 'joined', label: '已参加', role: 'none' },
  { id: 'in_progress', label: '进行中', role: 'in_progress' },
  { id: 'completed', label: '已完成', role: 'completed' }
];

function legacyActivityField() {
  return { id: 'status', name: '进度', type: 'select', showInLedger: true, showInStats: true, options: LEGACY_ACTIVITY_OPTIONS.map(option => ({ ...option })) };
}

function normalizeActivityFields(rawFields) {
  const fields = Array.isArray(rawFields) && rawFields.length ? rawFields : [legacyActivityField()];
  return fields.slice(0, 12).map((field, index) => {
    const type = ACTIVITY_FIELD_TYPES.has(field?.type) ? field.type : 'select';
    const id = String(field?.id || `field_${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || `field_${index + 1}`;
    const base = {
      id,
      name: String(field?.name || `字段 ${index + 1}`).trim().slice(0, 40) || `字段 ${index + 1}`,
      type,
      showInLedger: field?.showInLedger !== false,
      showInStats: field?.showInStats !== false
    };
    if (type !== 'select') return base;
    const options = (Array.isArray(field?.options) && field.options.length ? field.options : (index === 0 ? LEGACY_ACTIVITY_OPTIONS : []))
      .slice(0, 12).map((option, optionIndex) => ({
        id: String(option?.id || `option_${optionIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || `option_${optionIndex + 1}`,
        label: String(option?.label || '').trim().slice(0, 24),
        role: ['none', 'completed', 'in_progress', 'risk'].includes(option?.role) ? option.role : 'none'
      })).filter((option, optionIndex, options) => option.label && options.findIndex(item => item.id === option.id) === optionIndex);
    return { ...base, options: options.length ? options : LEGACY_ACTIVITY_OPTIONS.map(option => ({ ...option })) };
  }).filter((field, index, fields) => fields.findIndex(item => item.id === field.id) === index);
}

function normalizeActivityValue(field, value) {
  if (field.type === 'checkbox') return value === true || value === 'true' || value === 1 || value === '1';
  if (field.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  if (field.type === 'number') {
    if (value === '' || value == null) return '';
    return Number.isFinite(Number(value)) ? String(Number(value)) : '';
  }
  if (field.type === 'text') return String(value || '').trim().slice(0, 160);
  return field.options.some(option => option.id === value) ? String(value) : '';
}

function normalizeActivityRecord(template, rawValue) {
  const legacyValue = typeof rawValue === 'string' ? rawValue : null;
  const values = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const record = Object.fromEntries(template.fields.map(field => {
    const source = legacyValue != null && field.id === 'status' ? legacyValue : values[field.id];
    return [field.id, normalizeActivityValue(field, source)];
  }).filter(([, value]) => value !== '' && value !== false));
  return record;
}

function normalizePortfolio(portfolio) {
  const normalized = portfolio && typeof portfolio === 'object' ? portfolio : emptyState();
  normalized.managers ||= [];
  normalized.phones ||= [];
  normalized.walletNames ||= {};
  normalized.walletMetadata ||= {};
  const phoneIds = new Set(normalized.phones.map(phone => phone.id));
  const rawWalletCounts = normalized.walletCounts && typeof normalized.walletCounts === 'object' ? normalized.walletCounts : {};
  normalized.walletCounts = Object.fromEntries(normalized.phones.map(phone => [phone.id, Math.min(10, Math.max(1, Number(rawWalletCounts[phone.id]) || 3))]));
  const hasValidWalletKey = key => {
    const [phoneId, walletText] = String(key).split(':'); const wallet = Number(walletText);
    return phoneIds.has(phoneId) && Number.isInteger(wallet) && wallet >= 1 && wallet <= normalized.walletCounts[phoneId];
  };
  normalized.walletNames = Object.fromEntries(Object.entries(normalized.walletNames)
    .filter(([key, value]) => hasValidWalletKey(key) && String(value || '').trim())
    .map(([key, value]) => [key, String(value).trim().slice(0, 32)]));
  const validSybilStatuses = new Set(['unreviewed', 'pending', 'normal', 'suspected', 'confirmed']);
  normalized.walletMetadata = Object.fromEntries(Object.entries(normalized.walletMetadata).filter(([key]) => hasValidWalletKey(key)).map(([key, value]) => {
    const metadata = value && typeof value === 'object' ? value : {};
    return [key, {
      createdAt: String(metadata.createdAt || '').slice(0, 25),
      sybilStatus: validSybilStatuses.has(metadata.sybilStatus) ? metadata.sybilStatus : 'unreviewed',
      note: String(metadata.note || '').slice(0, 200),
      updatedAt: metadata.updatedAt || null
    }];
  }));
  normalized.walletActivityTemplates = (Array.isArray(normalized.walletActivityTemplates) ? normalized.walletActivityTemplates : [])
    .map((template, index) => ({
      id: String(template?.id || `WA-${String(index + 1).padStart(3, '0')}`).slice(0, 40),
      name: String(template?.name || '').trim().slice(0, 40),
      description: String(template?.description || '').trim().slice(0, 160),
      fields: normalizeActivityFields(template?.fields),
      createdAt: template?.createdAt || null,
      archived: Boolean(template?.archived)
    }))
    .filter((template, index, templates) => template.name && templates.findIndex(item => item.id === template.id) === index);
  const templatesById = new Map(normalized.walletActivityTemplates.map(template => [template.id, template]));
  normalized.walletActivityStatuses = Object.fromEntries(Object.entries(normalized.walletActivityStatuses || {}).filter(([walletKey]) => hasValidWalletKey(walletKey)).map(([walletKey, values]) => {
    const statuses = values && typeof values === 'object' ? values : {};
    return [walletKey, Object.fromEntries(Object.entries(statuses)
      .filter(([activityId]) => templatesById.has(activityId))
      .map(([activityId, value]) => [activityId, normalizeActivityRecord(templatesById.get(activityId), value)])
      .filter(([, value]) => Object.keys(value).length))];
  }).filter(([, values]) => Object.keys(values).length));
  normalized.addresses = (Array.isArray(normalized.addresses) ? normalized.addresses : []).map(item => ({
    ...item,
    nextSyncAt: Number.isFinite(Date.parse(item.nextSyncAt)) ? new Date(item.nextSyncAt).toISOString() : randomRefreshAt()
  }));
  normalized.customNetworks ||= [];
  normalized.customTokens ||= [];
  const tokenDefinitions = new Map();
  for (const original of normalized.customTokens) {
    const chain = String(original.chain || '').trim();
    const contract = String(original.contract || '').trim();
    if (!chain || !contract) continue;
    const key = `${chain.toLowerCase()}|${contract.toLowerCase()}`;
    if (tokenDefinitions.has(key)) continue;
    const numericPrice = Number(original.manualPrice ?? original.price ?? 0);
    const priceMode = original.priceMode === 'manual' || original.priceMode === 'auto' ? original.priceMode : numericPrice > 0 ? 'manual' : 'auto';
    const token = { ...original, scope: 'all', priceMode, manualPrice: priceMode === 'manual' ? numericPrice : null };
    delete token.addressId;
    delete token.balance;
    if (priceMode === 'auto' && !AUTO_PRICE_SOURCES.has(token.quoteSource)) {
      token.price = null;
      token.change24 = null;
      token.liquidityUsd = null;
      token.status = 'pending';
    }
    tokenDefinitions.set(key, token);
  }
  for (const systemToken of systemTokenDefinitions()) {
    const key = `${systemToken.chain.toLowerCase()}|${systemToken.contract.toLowerCase()}`;
    const existing = tokenDefinitions.get(key);
    tokenDefinitions.set(key, existing
      ? { ...existing, system: true, category: systemToken.category, source: systemToken.source, sourceUrl: systemToken.sourceUrl, referencePriceId: systemToken.referencePriceId || null }
      : systemToken);
  }
  normalized.customTokens = [...tokenDefinitions.values()];
  const customTokensById = new Map(normalized.customTokens.map(token => [token.id, token]));
  normalized.assets = (normalized.assets || []).map(asset => {
    const token = customTokensById.get(asset.customTokenId);
    if (!token || token.priceMode !== 'auto' || AUTO_PRICE_SOURCES.has(asset.priceSource)) return asset;
    return { ...asset, value: null, price: null, change: null, priceSource: null };
  });
  normalized.netWorthHistory = (Array.isArray(normalized.netWorthHistory) ? normalized.netWorthHistory : [])
    .map(point => ({ timestamp: Number(point.timestamp), total: Number(point.total) }))
    .filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.total) && point.total >= 0)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-24 * 366);
  if (!normalized.netWorthHistory.length && normalized.assets.length) {
    const total = normalized.assets.reduce((sum, asset) => sum + (Number.isFinite(Number(asset.value)) ? Number(asset.value) : 0), 0);
    normalized.netWorthHistory.push({ timestamp: Number(normalized.lastSync) || Date.now(), total });
  }
  normalized.sync ||= { status: 'idle', startedAt: null, finishedAt: null, error: null };
  normalized.scheduler = {
    ...normalized.scheduler,
    mode: 'random',
    minIntervalHours: RANDOM_REFRESH_MIN_HOURS,
    maxIntervalHours: RANDOM_REFRESH_MAX_HOURS,
    concurrencyPerChain: CONCURRENCY_PER_CHAIN,
    lastBatchAt: normalized.scheduler?.lastBatchAt || null,
    lastBatchSize: Number(normalized.scheduler?.lastBatchSize || 0),
    nextBatchAt: nextAddressSchedule(normalized.addresses)
  };
  delete normalized.scheduler.intervalMinutes;
  delete normalized.scheduler.nextFullCycleAt;
  normalized.version = 13;
  return normalized;
}

function recordNetWorthSnapshot(timestamp = Date.now()) {
  const total = state.assets.reduce((sum, asset) => sum + (Number.isFinite(Number(asset.value)) ? Number(asset.value) : 0), 0);
  const point = { timestamp, total };
  const history = Array.isArray(state.netWorthHistory) ? state.netWorthHistory.slice() : [];
  const hour = Math.floor(timestamp / HOUR);
  if (history.length && Math.floor(Number(history.at(-1).timestamp) / HOUR) === hour) history[history.length - 1] = point;
  else history.push(point);
  state.netWorthHistory = history.slice(-24 * 366);
}

const requestContext = new AsyncLocalStorage();
let store;
let saveQueue = Promise.resolve();
let setupInProgress = false;
const syncPromises = new Map();
const state = new Proxy({}, {
  get(_target, property) { return requestContext.getStore()?.portfolio?.[property]; },
  set(_target, property, value) {
    const context = requestContext.getStore();
    if (!context?.portfolio) throw new Error('缺少用户数据上下文');
    context.portfolio[property] = value;
    return true;
  },
  ownKeys() { return Reflect.ownKeys(requestContext.getStore()?.portfolio || {}); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
});

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, saltText, hashText] = String(encoded).split('$');
    if (algorithm !== 'scrypt') return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = Buffer.from(await scryptAsync(String(password), Buffer.from(saltText, 'base64url'), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 }));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch { return false; }
}

function normalizeUsername(value) { return String(value || '').trim(); }
function usernameKey(value) { return normalizeUsername(value).toLocaleLowerCase('zh-CN'); }
function validUsername(value) { return /^[\p{L}\p{N}_.-]{3,32}$/u.test(value); }
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && value.length <= 128; }
function publicUser(user) { return { id: user.id, username: user.username, role: user.role, status: user.status, createdAt: user.createdAt }; }
function sha256(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function nextUserId() { return `U-${String(store.users.length + 1).padStart(4, '0')}`; }

async function saveStore() {
  const snapshot = JSON.stringify(store, null, 2);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    await writeFile(tempStateFile, snapshot, 'utf8');
    await rename(tempStateFile, stateFile);
  });
  return saveQueue;
}

async function saveState() { return saveStore(); }

async function loadStore() {
  await mkdir(dataRoot, { recursive: true });
  let loaded = null;
  try { loaded = JSON.parse(await readFile(stateFile, 'utf8')); }
  catch { /* A new local installation starts with the owner setup wizard. */ }

  if ([5, 6].includes(loaded?.version) && Array.isArray(loaded.users) && loaded.portfolios) {
    store = loaded;
    store.invites ||= [];
    store.settings ||= { registrationMode: 'invite' };
    store.settings.registrationMode = store.settings.registrationMode === 'invite' ? 'invite' : 'disabled';
    store.instance ||= {};
    store.instance.sessionSecret ||= randomBytes(48).toString('base64url');
    for (const user of store.users) store.portfolios[user.id] = normalizePortfolio(store.portfolios[user.id]);
  } else if (String(process.env.INITIAL_ADMIN_PASSWORD_HASH || '').startsWith('scrypt$')) {
    const username = normalizeUsername(process.env.INITIAL_ADMIN_USERNAME || 'chainfolio');
    const passwordHash = String(process.env.INITIAL_ADMIN_PASSWORD_HASH || '');
    const user = { id: 'U-0001', username, usernameKey: usernameKey(username), passwordHash, role: 'admin', status: 'active', sessionVersion: 1, createdAt: new Date().toISOString() };
    store = { version: 6, users: [user], invites: [], settings: { registrationMode: 'invite' }, instance: { sessionSecret: randomBytes(48).toString('base64url') }, portfolios: { [user.id]: normalizePortfolio(loaded || initialState()) } };
  } else {
    const pendingPortfolio = loaded && typeof loaded === 'object' ? normalizePortfolio(loaded) : null;
    store = { version: 6, users: [], invites: [], settings: { registrationMode: 'disabled' }, instance: { sessionSecret: randomBytes(48).toString('base64url') }, portfolios: pendingPortfolio ? { __pending__: pendingPortfolio } : {} };
  }
  store.version = 6;
  await saveStore();
}

function json(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('请求内容过大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sessionSecret() {
  const configured = String(process.env.SESSION_SECRET || '');
  const secret = configured.length >= 32 ? configured : String(store?.instance?.sessionSecret || '');
  if (secret.length < 32) throw new Error('本机实例缺少有效的会话密钥');
  return secret;
}

function signSession(user, csrf = randomBytes(24).toString('base64url')) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, ver: user.sessionVersion || 1, csrf, exp: Date.now() + SESSION_MAX_AGE })).toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, csrf };
}

function readSession(request) {
  try {
    const token = parseCookies(request).chainfolio_session;
    if (!token) return null;
    const [payload, signature] = token.split('.');
    const expected = createHmac('sha256', sessionSecret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.uid || session.exp < Date.now()) return null;
    const user = store.users.find(item => item.id === session.uid);
    if (!user || user.status !== 'active' || Number(user.sessionVersion || 1) !== Number(session.ver)) return null;
    return { user, csrf: session.csrf };
  } catch { return null; }
}

function shouldUseSecureCookie(request) {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return String(request?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}

function setSessionCookie(request, response, user) {
  const session = signSession(user);
  const secure = shouldUseSecureCookie(request) ? '; Secure' : '';
  response.setHeader('set-cookie', `chainfolio_session=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_MAX_AGE / 1000)}${secure}`);
  return session.csrf;
}

function clearSessionCookie(request, response) {
  const secure = shouldUseSecureCookie(request) ? '; Secure' : '';
  response.setHeader('set-cookie', `chainfolio_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function requestIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',').map(value => value.trim()).filter(Boolean);
  return forwarded.at(-1) || request.socket.remoteAddress || 'unknown';
}

const authAttempts = new Map();
function consumeAttempt(key, limit = 8, windowMs = 15 * MINUTE) {
  const now = Date.now();
  const current = authAttempts.get(key);
  if (!current || current.resetAt < now) {
    authAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function clearAttempts(key) { authAttempts.delete(key); }
function requireCsrf(request, session) { return session && String(request.headers['x-csrf-token'] || '') === session.csrf; }

function createInviteCode() {
  const raw = randomBytes(9).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(12, 'X').slice(0, 12);
  return `CF-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function publicSetupStatus() {
  return {
    needsSetup: store.users.length === 0,
    registrationMode: store.settings.registrationMode,
    registrationEnabled: store.settings.registrationMode === 'invite',
    product: 'Chainfolio'
  };
}

async function handleSetupApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/setup/status') return json(response, 200, publicSetupStatus());
  if (request.method !== 'POST' || url.pathname !== '/api/setup/owner') return json(response, 404, { error: '初始化接口不存在' });
  if (store.users.length || setupInProgress) return json(response, 409, { error: '本机主账户已经创建，请直接登录' });
  const ip = requestIp(request);
  if (!consumeAttempt(`setup:${ip}`, 5, HOUR)) return json(response, 429, { error: '初始化尝试过多，请稍后再试' });
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  if (!validUsername(username)) return json(response, 400, { error: '用户名需为 3–32 位中文、字母、数字、点、横线或下划线' });
  if (!validPassword(body.password)) return json(response, 400, { error: '密码需为 10–128 个字符' });
  setupInProgress = true;
  try {
    if (store.users.length) return json(response, 409, { error: '本机主账户已经创建，请直接登录' });
    const owner = { id: 'U-0001', username, usernameKey: usernameKey(username), passwordHash: await hashPassword(body.password), role: 'admin', status: 'active', sessionVersion: 1, createdAt: new Date().toISOString() };
    store.users.push(owner);
    store.portfolios[owner.id] = store.portfolios.__pending__ || emptyState();
    delete store.portfolios.__pending__;
    const csrfToken = setSessionCookie(request, response, owner);
    clearAttempts(`setup:${ip}`);
    await saveStore();
    return json(response, 201, { user: publicUser(owner), csrfToken });
  } finally { setupInProgress = false; }
}

async function handleAuthApi(request, response, url) {
  const session = readSession(request);
  if (request.method === 'GET' && url.pathname === '/api/auth/me') {
    if (!session) return json(response, 401, { error: '请先登录' });
    return json(response, 200, { user: publicUser(session.user), csrfToken: session.csrf });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(request);
    const loginKey = `${requestIp(request)}:${usernameKey(body.username)}`;
    if (!consumeAttempt(`login:${loginKey}`)) return json(response, 429, { error: '登录尝试过多，请 15 分钟后再试' });
    const user = store.users.find(item => item.usernameKey === usernameKey(body.username));
    const valid = user && await verifyPassword(body.password, user.passwordHash);
    if (!valid || user.status !== 'active') return json(response, 401, { error: '用户名或密码错误' });
    clearAttempts(`login:${loginKey}`);
    user.lastLoginAt = new Date().toISOString();
    const csrfToken = setSessionCookie(request, response, user);
    await saveStore();
    return json(response, 200, { user: publicUser(user), csrfToken });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    if (store.settings.registrationMode !== 'invite') return json(response, 403, { error: '本机未开启团队注册，请联系本机主账户管理员' });
    const ip = requestIp(request);
    if (!consumeAttempt(`register:${ip}`, 5, HOUR)) return json(response, 429, { error: '注册尝试过多，请稍后再试' });
    const body = await readJson(request);
    const username = normalizeUsername(body.username);
    if (!validUsername(username)) return json(response, 400, { error: '用户名需为 3–32 位中文、字母、数字、点、横线或下划线' });
    if (!validPassword(body.password)) return json(response, 400, { error: '密码需为 10–128 个字符' });
    if (store.users.some(item => item.usernameKey === usernameKey(username))) return json(response, 409, { error: '用户名已被使用' });
    const inviteHash = sha256(String(body.inviteCode || '').trim().toUpperCase());
    const invite = store.invites.find(item => item.codeHash === inviteHash && !item.usedAt && !item.revokedAt);
    if (!invite) return json(response, 400, { error: '邀请码无效或已被使用' });
    const user = { id: nextUserId(), username, usernameKey: usernameKey(username), passwordHash: await hashPassword(body.password), role: 'user', status: 'active', sessionVersion: 1, createdAt: new Date().toISOString() };
    store.users.push(user);
    store.portfolios[user.id] = emptyState();
    invite.usedAt = new Date().toISOString();
    invite.usedBy = user.id;
    const csrfToken = setSessionCookie(request, response, user);
    await saveStore();
    return json(response, 201, { user: publicUser(user), csrfToken });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    if (!session || !requireCsrf(request, session)) return json(response, 403, { error: '会话验证失败' });
    clearSessionCookie(request, response);
    return json(response, 200, { ok: true });
  }

  if (request.method === 'POST' && url.pathname === '/api/auth/change-password') {
    if (!session || !requireCsrf(request, session)) return json(response, 403, { error: '会话验证失败' });
    const body = await readJson(request);
    if (!await verifyPassword(body.currentPassword, session.user.passwordHash)) return json(response, 400, { error: '当前密码不正确' });
    if (!validPassword(body.newPassword)) return json(response, 400, { error: '新密码需为 10–128 个字符' });
    session.user.passwordHash = await hashPassword(body.newPassword);
    session.user.sessionVersion = Number(session.user.sessionVersion || 1) + 1;
    const csrfToken = setSessionCookie(request, response, session.user);
    await saveStore();
    return json(response, 200, { user: publicUser(session.user), csrfToken });
  }

  return json(response, 404, { error: '账户接口不存在' });
}

async function handleAdminApi(request, response, url, session) {
  if (session.user.role !== 'admin') return json(response, 403, { error: '仅管理员可以执行此操作' });
  if (request.method === 'GET' && url.pathname === '/api/admin/settings') {
    return json(response, 200, { settings: { registrationMode: store.settings.registrationMode } });
  }
  if (request.method === 'PATCH' && url.pathname === '/api/admin/settings') {
    const body = await readJson(request);
    if (!['disabled', 'invite'].includes(body.registrationMode)) return json(response, 400, { error: '团队注册设置无效' });
    store.settings.registrationMode = body.registrationMode;
    await saveStore();
    return json(response, 200, { settings: { registrationMode: store.settings.registrationMode } });
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/users') {
    return json(response, 200, { users: store.users.map(user => ({ ...publicUser(user), lastLoginAt: user.lastLoginAt || null })) });
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/invites') {
    return json(response, 200, { invites: store.invites.map(item => {
      const invite = { ...item };
      delete invite.codeHash;
      return invite;
    }) });
  }
  if (request.method === 'POST' && url.pathname === '/api/admin/invites') {
    if (store.settings.registrationMode !== 'invite') return json(response, 409, { error: '请先开启邀请码团队注册' });
    const body = await readJson(request);
    const code = createInviteCode();
    const invite = { id: `I-${String(store.invites.length + 1).padStart(4, '0')}`, codeHash: sha256(code), label: String(body.label || '').trim().slice(0, 40), createdAt: new Date().toISOString(), createdBy: session.user.id };
    store.invites.push(invite);
    await saveStore();
    return json(response, 201, { invite: { id: invite.id, label: invite.label, createdAt: invite.createdAt, code } });
  }
  if (request.method === 'DELETE' && /^\/api\/admin\/invites\/[^/]+$/.test(url.pathname)) {
    const inviteId = decodeURIComponent(url.pathname.split('/')[4]);
    const invite = store.invites.find(item => item.id === inviteId);
    if (!invite) return json(response, 404, { error: '邀请码不存在' });
    if (invite.usedAt) return json(response, 409, { error: '已使用的邀请码不能撤销' });
    invite.revokedAt = new Date().toISOString();
    await saveStore();
    return json(response, 200, { ok: true });
  }
  if (request.method === 'PATCH' && /^\/api\/admin\/users\/[^/]+$/.test(url.pathname)) {
    const userId = decodeURIComponent(url.pathname.split('/')[4]);
    const user = store.users.find(item => item.id === userId);
    const body = await readJson(request);
    if (!user) return json(response, 404, { error: '用户不存在' });
    if (user.id === session.user.id) return json(response, 409, { error: '不能停用自己的管理员账户' });
    if (!['active', 'disabled'].includes(body.status)) return json(response, 400, { error: '账户状态无效' });
    user.status = body.status;
    user.sessionVersion = Number(user.sessionVersion || 1) + 1;
    await saveStore();
    return json(response, 200, { user: publicUser(user) });
  }
  return json(response, 404, { error: '管理员接口不存在' });
}

function nextId(items, prefix) {
  const next = Math.max(0, ...items.map(item => Number(String(item.id).split('-')[1]) || 0)) + 1;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

async function rpcCall(urlOrUrls, method, params) {
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(12_000)
        });
        if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
        const body = await response.json();
        if (body.error) throw new Error(body.error.message || 'RPC 查询失败');
        return body.result;
      } catch (error) { lastError = error; }
    }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
  }
  throw lastError || new Error('RPC 查询失败');
}

function createKeyedLimiter(limit) {
  const buckets = new Map();
  return (key, task) => new Promise((resolve, reject) => {
    const bucket = buckets.get(key) || { active: 0, queue: [] };
    buckets.set(key, bucket);
    bucket.queue.push({ task, resolve, reject });
    const pump = () => {
      while (bucket.active < limit && bucket.queue.length) {
        const job = bucket.queue.shift();
        bucket.active += 1;
        Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { bucket.active -= 1; pump(); });
      }
    };
    pump();
  });
}

function unitsFromBigInt(value, decimals) {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = String(value % base).padStart(decimals, '0').slice(0, 8).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function nullableNumber(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

async function getPrices(networks) {
  if (process.env.DISABLE_MARKET_PRICES === 'true') return {};
  const ids = [...new Set(networks.map(network => network.priceId).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const url = `${COINGECKO_API_BASE}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd&include_24hr_change=true`;
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Chainfolio/1.0' }, signal: AbortSignal.timeout(10_000) });
    if (response.ok) {
      const result = await response.json();
      if (Object.keys(result).length) return result;
    }
  } catch { /* try the fallback below */ }

  const symbols = { ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB', okb: 'OKB' };
  const fallback = {};
  await Promise.all(ids.map(async id => {
    try {
      const response = await fetch(`https://api.coinbase.com/v2/prices/${symbols[id]}-USD/spot`, { headers: { accept: 'application/json', 'user-agent': 'Chainfolio/1.0' }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return;
      const result = await response.json();
      const usd = Number(result.data?.amount || 0);
      if (usd) fallback[id] = { usd };
    } catch { /* keep price unavailable */ }
  }));
  const missing = ids.filter(id => !fallback[id]);
  await Promise.all(missing.map(async id => {
    try {
      const response = await fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbols[id]}USDT`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return;
      const result = await response.json();
      const usd = Number(result.price || 0);
      if (usd) fallback[id] = { usd };
    } catch { /* keep price unavailable */ }
  }));
  return fallback;
}

function networksForSync() {
  const custom = (state.customNetworks || []).map(network => ({ ...network, decimals: Number(network.decimals) || 18, priceId: null }));
  return [...networkCatalog, ...custom];
}

function isEvmChain(chain) {
  return chain === 'EVM' || networksForSync().some(network => network.type === 'EVM' && network.name === chain);
}

function isDuplicateAddress(address, chain, ignoredId = null) {
  const normalized = address.toLowerCase();
  return state.addresses.some(item => item.id !== ignoredId
    && item.address.toLowerCase() === normalized
    && (item.chain === chain || (isEvmChain(item.chain) && isEvmChain(chain))));
}

function addressTargetChains(item) {
  if (item.chain !== 'EVM') return [item.chain];
  return networksForSync().filter(network => network.type === 'EVM').map(network => network.name);
}

function addressSupportsNetwork(item, network) {
  return item.chain === network.name || (item.chain === 'EVM' && network.type === 'EVM');
}

const dexQuoteCache = new Map();
async function getTrustedWrappedAssetFallback(network, contract) {
  const definition = trustedWrappedAssets.get(`${String(network?.name || '').toLowerCase()}|${String(contract || '').toLowerCase()}`);
  if (!definition) return null;
  const cacheKey = `wrapped-reference|${definition.priceId}`;
  const cached = dexQuoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  const prices = await getPrices([{ priceId: definition.priceId }]);
  const market = prices[definition.priceId] || {};
  const price = Number(market.usd);
  if (!Number.isFinite(price) || price <= 0) {
    const unavailable = {
      price: null,
      change24: null,
      liquidityUsd: null,
      source: 'wrapped-native-fallback',
      dexId: null,
      pairAddress: null,
      url: definition.url,
      quotedAt: new Date().toISOString(),
      error: 'ETH 参考价格暂时不可用'
    };
    dexQuoteCache.set(cacheKey, { quote: unavailable, expiresAt: Date.now() + MINUTE });
    return unavailable;
  }
  const quote = {
    price,
    change24: nullableNumber(market.usd_24h_change),
    liquidityUsd: null,
    source: 'wrapped-native-fallback',
    dexId: null,
    pairAddress: null,
    url: definition.url,
    quotedAt: new Date().toISOString(),
    error: null
  };
  dexQuoteCache.set(cacheKey, { quote, expiresAt: Date.now() + 5 * MINUTE });
  return quote;
}

async function getDexQuote(network, contract) {
  const chainId = network?.dexScreenerId;
  const stablecoinFallback = getTrustedStablecoinFallback(network, contract);
  if (stablecoinFallback) return stablecoinFallback;
  const wrappedFallback = await getTrustedWrappedAssetFallback(network, contract);
  if (wrappedFallback) return wrappedFallback;
  if (!chainId) return stablecoinFallback || { price: null, change24: null, liquidityUsd: null, source: null, error: '该链暂不支持自动报价' };
  const normalizedContract = String(contract).toLowerCase();
  const cacheKey = `${chainId}|${normalizedContract}`;
  const cached = dexQuoteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;
  try {
    const baseUrl = String(process.env.DEX_SCREENER_BASE_URL || 'https://api.dexscreener.com').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(contract)}`, {
      headers: { accept: 'application/json', 'user-agent': 'Chainfolio/1.0' },
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`行情服务 HTTP ${response.status}`);
    const pairs = await response.json();
    const candidates = (Array.isArray(pairs) ? pairs : []).flatMap(pair => {
      const baseAddress = String(pair.baseToken?.address || '').toLowerCase();
      const quoteAddress = String(pair.quoteToken?.address || '').toLowerCase();
      const basePriceUsd = Number(pair.priceUsd);
      if (baseAddress === normalizedContract && basePriceUsd > 0) return [{ pair, price: basePriceUsd, change24: pair.priceChange?.h24 }];
      const basePriceInQuote = Number(pair.priceNative);
      if (quoteAddress === normalizedContract && basePriceUsd > 0 && basePriceInQuote > 0) {
        return [{ pair, price: basePriceUsd / basePriceInQuote, change24: null }];
      }
      return [];
    });
    const candidate = candidates.sort((left, right) => Number(right.pair.liquidity?.usd || 0) - Number(left.pair.liquidity?.usd || 0))[0];
    if (!candidate) {
      if (stablecoinFallback) return stablecoinFallback;
      throw new Error('没有找到包含美元报价的流动性池');
    }
    const { pair } = candidate;
    const quote = {
      price: candidate.price,
      change24: nullableNumber(candidate.change24),
      liquidityUsd: Number.isFinite(Number(pair.liquidity?.usd)) ? Number(pair.liquidity.usd) : null,
      source: 'dexscreener',
      dexId: pair.dexId || null,
      pairAddress: pair.pairAddress || null,
      url: pair.url || null,
      quotedAt: new Date().toISOString(),
      error: null
    };
    dexQuoteCache.set(cacheKey, { quote, expiresAt: Date.now() + 5 * MINUTE });
    return quote;
  } catch (error) {
    if (stablecoinFallback) {
      dexQuoteCache.set(cacheKey, { quote: stablecoinFallback, expiresAt: Date.now() + 5 * MINUTE });
      return stablecoinFallback;
    }
    const quote = { price: null, change24: null, liquidityUsd: null, source: null, error: error.message };
    dexQuoteCache.set(cacheKey, { quote, expiresAt: Date.now() + MINUTE });
    return quote;
  }
}

function validateCustomToken(body, ignoredId = null) {
  const chain = String(body.chain || '').trim();
  const contract = String(body.contract || '').trim();
  const symbol = String(body.symbol || '').trim().toUpperCase();
  const name = String(body.name || symbol).trim();
  const decimals = Number(body.decimals);
  const priceMode = body.price === '' || body.price == null ? 'auto' : 'manual';
  const manualPrice = priceMode === 'manual' ? Number(body.price) : null;
  const network = networksForSync().find(item => item.name === chain);
  if (!network || !state.addresses.some(item => addressSupportsNetwork(item, network))) return { error: '请先导入至少一个支持该区块链的钱包地址' };
  if (network.type === 'EVM' && !/^0x[a-fA-F0-9]{40}$/.test(contract)) return { error: 'EVM 币种合约地址格式不正确' };
  if (network.type === 'SVM' && contract.length < 32) return { error: 'Solana Mint 地址格式不正确' };
  if (!symbol || symbol.length > 16 || !Number.isInteger(decimals) || decimals < 0 || decimals > 36 || (priceMode === 'manual' && (!Number.isFinite(manualPrice) || manualPrice < 0))) return { error: '币种符号、精度或价格无效' };
  const duplicate = state.customTokens.find(item => item.id !== ignoredId && item.chain === chain && item.contract.toLowerCase() === contract.toLowerCase());
  if (duplicate) {
    if (duplicate.system && ignoredId == null) return { token: duplicate, existing: true };
    return { error: '这个币种已经添加到全账户目录', status: 409 };
  }
  return { token: { scope: 'all', chain, contract, symbol, name: name || symbol, decimals, priceMode, manualPrice } };
}

function decodeAbiString(value) {
  const hex = String(value || '').replace(/^0x/, '');
  if (!hex || hex.length % 2) return '';
  try {
    if (hex.length >= 128) {
      const offset = Number(BigInt(`0x${hex.slice(0, 64)}`)) * 2;
      if (offset + 64 <= hex.length) {
        const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`));
        const start = offset + 64; const end = start + length * 2;
        if (end <= hex.length) return Buffer.from(hex.slice(start, end), 'hex').toString('utf8').replace(/\0/g, '').trim();
      }
    }
    return Buffer.from(hex.slice(0, 64), 'hex').toString('utf8').replace(/\0/g, '').trim();
  } catch { return ''; }
}

function readBorshString(buffer, offset) {
  if (offset + 4 > buffer.length) return { value: '', next: buffer.length };
  const length = buffer.readUInt32LE(offset); const start = offset + 4; const end = Math.min(start + length, buffer.length);
  return { value: buffer.subarray(start, end).toString('utf8').replace(/\0/g, '').trim(), next: end };
}

async function detectTokenMetadata(body) {
  const network = networksForSync().find(item => item.name === String(body.chain || ''));
  const contract = String(body.contract || '').trim();
  if (!network || !state.addresses.some(item => addressSupportsNetwork(item, network))) throw new Error('请先导入至少一个支持该区块链的钱包地址');
  if (network.type === 'EVM') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) throw new Error('EVM 币种合约地址格式不正确');
    const code = await rpcCall(network.rpc, 'eth_getCode', [contract, 'latest']);
    if (!code || code === '0x') throw new Error('该地址在所选链上不是合约');
    const selectors = { name: '0x06fdde03', symbol: '0x95d89b41', decimals: '0x313ce567' };
    const entries = await Promise.all(Object.entries(selectors).map(async ([field, data]) => {
      try { return [field, await rpcCall(network.rpc, 'eth_call', [{ to: contract, data }, 'latest'])]; }
      catch { return [field, null]; }
    }));
    const values = Object.fromEntries(entries);
    const decimals = values.decimals ? Number(BigInt(values.decimals)) : null;
    const metadata = { name: decodeAbiString(values.name), symbol: decodeAbiString(values.symbol), decimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : null };
    if (!metadata.name && !metadata.symbol && metadata.decimals == null) throw new Error('合约没有返回标准 ERC-20 元数据，请手动填写');
    const quote = await getDexQuote(network, contract);
    return { ...metadata, source: 'contract', quote, warning: !metadata.name || !metadata.symbol || metadata.decimals == null ? '部分字段未返回，请手动补充' : null };
  }

  if (contract.length < 32) throw new Error('Solana Mint 地址格式不正确');
  const mint = await rpcCall(network.rpc, 'getAccountInfo', [contract, { encoding: 'jsonParsed', commitment: 'confirmed' }]);
  const decimals = Number(mint?.value?.data?.parsed?.info?.decimals);
  if (!Number.isInteger(decimals)) throw new Error('没有找到有效的 Solana Mint');
  let name = ''; let symbol = '';
  try {
    const metadataAccounts = await rpcCall(network.rpc, 'getProgramAccounts', ['metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', { encoding: 'base64', filters: [{ memcmp: { offset: 33, bytes: contract } }] }]);
    const encoded = metadataAccounts?.[0]?.account?.data?.[0];
    if (encoded) {
      const buffer = Buffer.from(encoded, 'base64');
      const parsedName = readBorshString(buffer, 65); const parsedSymbol = readBorshString(buffer, parsedName.next);
      name = parsedName.value; symbol = parsedSymbol.value;
    }
  } catch { /* some public RPCs do not expose Metaplex program scans */ }
  const quote = await getDexQuote(network, contract);
  return { name, symbol, decimals, source: name || symbol ? 'mint+metadata' : 'mint', quote, warning: !name || !symbol ? '已识别精度；名称或符号未找到，请手动补充' : null };
}

async function syncOneAddress(item, network, prices) {
  try {
    let amount;
    if (network.type === 'SVM') {
      const result = await rpcCall(network.rpc, 'getBalance', [item.address, { commitment: 'confirmed' }]);
      amount = Number(result.value) / 10 ** network.decimals;
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(item.address)) throw new Error('EVM 地址格式不正确');
      const result = await rpcCall(network.rpc, 'eth_getBalance', [item.address, 'latest']);
      amount = Number(unitsFromBigInt(BigInt(result), network.decimals));
    }
    const price = Number(prices[network.priceId]?.usd || 0);
    const change = Number(prices[network.priceId]?.usd_24h_change || 0);
    return {
      network: network.name,
      address: { ...item, status: 'synced', nativeBalance: amount, syncedAt: new Date().toISOString(), error: null },
      asset: { symbol: network.symbol, name: network.symbol, chain: network.name, phoneId: item.phoneId, wallet: item.wallet, amount: `${amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${network.symbol}`, change, value: amount * price, price, color: networkCatalog.find(entry => entry.name === network.name)?.color || '#ffbd66', source: 'rpc', addressId: item.id }
    };
  } catch (error) {
    return { network: network.name, address: { ...item, status: 'error', syncedAt: new Date().toISOString(), error: error.message }, asset: null, error: error.message };
  }
}

const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a1c0c5e7f8';
const SOLANA_TOKEN_PROGRAMS = ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnU3W1w4b'];

function paddedAddressTopic(address) {
  return `0x${String(address || '').toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}

function safeBigInt(value) {
  try { return BigInt(value || '0x0'); } catch { return 0n; }
}

function configuredToken(network, contract) {
  const normalized = String(contract || '').toLowerCase();
  return state.customTokens.some(token => token.chain === network.name && String(token.contract || '').toLowerCase() === normalized);
}

async function fetchIndexerJson(url, headers = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TOKEN_INDEXER_TIMEOUT_MS) });
  let body = null;
  try { body = await response.json(); } catch { /* include the HTTP status below */ }
  if (!response.ok) throw new Error(`索引服务 HTTP ${response.status}`);
  return body;
}

async function discoverEvmTokenCandidatesViaEtherscan(addressItem, network) {
  if (!ETHERSCAN_API_KEY || !network.chainId) return null;
  const url = new URL(ETHERSCAN_API_BASE);
  url.searchParams.set('chainid', network.chainId);
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', 'addresstokenbalance');
  url.searchParams.set('address', addressItem.address);
  url.searchParams.set('page', '1');
  url.searchParams.set('offset', String(TOKEN_DISCOVERY_MAX_TOKENS));
  url.searchParams.set('apikey', ETHERSCAN_API_KEY);
  const body = await fetchIndexerJson(url);
  const message = String(body?.message || body?.result || '');
  if (String(body?.status) !== '1') {
    if (/no token|not found/i.test(message)) return { candidates: [], mode: 'etherscan', error: null };
    throw new Error(`Etherscan: ${message || '返回格式无效'}`);
  }
  if (!Array.isArray(body?.result)) throw new Error('Etherscan: 返回的代币持仓格式无效');
  const candidates = (Array.isArray(body?.result) ? body.result : []).map(item => ({
    contract: String(item.TokenAddress || item.tokenAddress || ''),
    rawBalance: item.TokenQuantity ?? item.tokenQuantity ?? '0',
    metadata: { name: String(item.TokenName || item.tokenName || ''), symbol: String(item.TokenSymbol || item.tokenSymbol || ''), decimals: Number(item.TokenDivisor ?? item.tokenDivisor) },
    priceUsd: Number(item.TokenPriceUSD ?? item.tokenPriceUSD)
  })).filter(item => /^0x[a-fA-F0-9]{40}$/.test(item.contract) && safeBigInt(item.rawBalance) > 0n).slice(0, TOKEN_DISCOVERY_MAX_TOKENS);
  return { candidates, mode: 'etherscan', error: null };
}

async function discoverEvmTokenCandidatesViaBlockscout(addressItem, network) {
  if (!network.blockscoutApi) return null;
  const endpoint = `${network.blockscoutApi.replace(/\/$/, '')}/addresses/${encodeURIComponent(addressItem.address)}/token-balances`;
  const body = await fetchIndexerJson(endpoint);
  if (!Array.isArray(body) && !Array.isArray(body?.items)) throw new Error('Blockscout: 返回的代币持仓格式无效');
  const rows = Array.isArray(body) ? body : body.items;
  const candidates = rows.map(item => {
    const token = item?.token || {};
    return {
      contract: String(token.address_hash || token.addressHash || ''),
      rawBalance: item?.value ?? '0',
      metadata: { name: String(token.name || ''), symbol: String(token.symbol || ''), decimals: Number(token.decimals) },
      priceUsd: Number(token.exchange_rate),
      tokenType: String(token.type || 'ERC-20').toUpperCase()
    };
  }).filter(item => /^0x[a-fA-F0-9]{40}$/.test(item.contract)
    && safeBigInt(item.rawBalance) > 0n
    && item.tokenType === 'ERC-20'
    && (item.metadata.symbol || item.metadata.name || Number.isInteger(item.metadata.decimals)))
    .slice(0, TOKEN_DISCOVERY_MAX_TOKENS);
  return { candidates, mode: 'blockscout', error: null };
}

async function discoverEvmTokenContractsViaLogs(addressItem, network, runLimited, options = {}) {
  const latestHex = await runLimited(network.name, () => rpcCall(network.rpc, 'eth_blockNumber', []));
  const latest = Number(safeBigInt(latestHex));
  if (!Number.isSafeInteger(latest) || latest < 0) throw new Error('无法读取区块高度');
  const fullHistory = Boolean(options.deepDiscovery) || TOKEN_DISCOVERY_FULL_HISTORY;
  const from = fullHistory ? 0 : Math.max(0, latest - TOKEN_DISCOVERY_HISTORY_BLOCKS);
  const addressTopic = paddedAddressTopic(addressItem.address);
  const contracts = new Set();
  let totalLogs = 0;
  let start = from;
  let chunk = TOKEN_DISCOVERY_LOG_CHUNK;
  let scannedThrough = from - 1;
  let truncated = false;
  while (start <= latest) {
    const end = Math.min(latest, start + chunk);
    const filters = [
      { fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}`, topics: [ERC20_TRANSFER_TOPIC, addressTopic] },
      { fromBlock: `0x${start.toString(16)}`, toBlock: `0x${end.toString(16)}`, topics: [ERC20_TRANSFER_TOPIC, null, addressTopic] }
    ];
    try {
      const batches = await Promise.all(filters.map(filter => runLimited(network.name, () => rpcCall(network.rpc, 'eth_getLogs', [filter]))));
      for (const logs of batches) {
        for (const log of Array.isArray(logs) ? logs : []) {
          const contract = String(log?.address || '');
          if (/^0x[a-fA-F0-9]{40}$/.test(contract)) contracts.add(contract);
        }
        totalLogs += Array.isArray(logs) ? logs.length : 0;
      }
      scannedThrough = end;
      start = end + 1;
      if (contracts.size >= TOKEN_DISCOVERY_MAX_TOKENS || totalLogs >= TOKEN_DISCOVERY_MAX_LOGS) {
        truncated = start <= latest;
        break;
      }
    } catch (error) {
      if (chunk <= TOKEN_DISCOVERY_MIN_LOG_CHUNK) throw error;
      chunk = Math.max(TOKEN_DISCOVERY_MIN_LOG_CHUNK, Math.floor(chunk / 2));
    }
  }
  return { candidates: [...contracts].slice(0, TOKEN_DISCOVERY_MAX_TOKENS).map(contract => ({ contract, rawBalance: null })), truncated, scannedFrom: from, scannedThrough, totalLogs };
}

async function discoverEvmTokenCandidates(addressItem, network, runLimited, options = {}) {
  const errors = [];
  try {
    const result = await runLimited(network.name, () => rpcCall(network.rpc, 'alchemy_getTokenBalances', [addressItem.address, 'erc20']));
    if (!Array.isArray(result?.tokenBalances)) throw new Error('RPC 未提供 Token 索引方法');
    return { candidates: result.tokenBalances.map(item => ({ contract: String(item.contractAddress || ''), rawBalance: item.tokenBalance }))
      .filter(item => /^0x[a-fA-F0-9]{40}$/.test(item.contract) && safeBigInt(item.rawBalance) > 0n).slice(0, TOKEN_DISCOVERY_MAX_TOKENS), mode: 'indexer', error: null };
  } catch (indexerError) {
    errors.push(indexerError.message);
  }
  if (ETHERSCAN_API_KEY && network.chainId) {
    try {
      const etherscan = await discoverEvmTokenCandidatesViaEtherscan(addressItem, network);
      if (etherscan) return etherscan;
    } catch (error) { errors.push(error.message); }
  }
  if (network.blockscoutApi) {
    try {
      const blockscout = await discoverEvmTokenCandidatesViaBlockscout(addressItem, network);
      if (blockscout) return blockscout;
    } catch (error) { errors.push(error.message); }
  }
  try {
    const logs = await discoverEvmTokenContractsViaLogs(addressItem, network, runLimited, options);
    return { ...logs, mode: logs.truncated ? 'transfer-log-truncated' : 'transfer-log', error: null };
  } catch (error) {
    errors.push(error.message);
    return { candidates: [], mode: 'unavailable', error: errors.join('; ') };
  }
}

async function readEvmTokenMetadata(network, contract, runLimited) {
  const known = stablecoinDefinition(network.name, contract);
  if (known) return { name: known.name, symbol: known.symbol, decimals: known.decimals };
  const selectors = { name: '0x06fdde03', symbol: '0x95d89b41', decimals: '0x313ce567' };
  const entries = await Promise.all(Object.entries(selectors).map(async ([field, data]) => {
    try { return [field, await runLimited(network.name, () => rpcCall(network.rpc, 'eth_call', [{ to: contract, data }, 'latest']))]; }
    catch { return [field, null]; }
  }));
  const values = Object.fromEntries(entries);
  const decimalsRaw = values.decimals ? Number(safeBigInt(values.decimals)) : null;
  return {
    name: decodeAbiString(values.name) || '未知 ERC-20 代币',
    symbol: decodeAbiString(values.symbol) || `TOKEN-${contract.slice(2, 8).toUpperCase()}`,
    decimals: Number.isInteger(decimalsRaw) && decimalsRaw >= 0 && decimalsRaw <= 36 ? decimalsRaw : 18
  };
}

async function discoverEvmTokenAssets(addressItem, network, runLimited, options = {}) {
  const discovery = await discoverEvmTokenCandidates(addressItem, network, runLimited, options);
  const assets = [];
  const seenContracts = new Set();
  for (const candidate of discovery.candidates) {
    const contract = candidate.contract;
    const contractKey = String(contract).toLowerCase();
    if (seenContracts.has(contractKey)) continue;
    seenContracts.add(contractKey);
    if (configuredToken(network, contract)) continue;
    const candidateMetadata = candidate.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : null;
    const metadata = candidateMetadata && candidateMetadata.symbol && Number.isInteger(candidateMetadata.decimals) && candidateMetadata.decimals >= 0 && candidateMetadata.decimals <= 36
      ? { name: candidateMetadata.name || candidateMetadata.symbol, symbol: candidateMetadata.symbol, decimals: candidateMetadata.decimals }
      : await readEvmTokenMetadata(network, contract, runLimited);
    let rawBalance = safeBigInt(candidate.rawBalance);
    if (!rawBalance) {
      try {
        const owner = addressItem.address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
        const result = await runLimited(network.name, () => rpcCall(network.rpc, 'eth_call', [{ to: contract, data: `0x70a08231${owner}` }, 'latest']));
        rawBalance = safeBigInt(result);
      } catch { continue; }
    }
    if (rawBalance <= 0n) continue;
    const amountText = unitsFromBigInt(rawBalance, metadata.decimals);
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const indexedPrice = Number(candidate.priceUsd);
    const quote = Number.isFinite(indexedPrice) && indexedPrice > 0
      ? { price: indexedPrice, change24: null, liquidityUsd: null, source: discovery.mode, url: null, quotedAt: new Date().toISOString(), error: null }
      : await getDexQuote(network, contract);
    const stablecoin = stablecoinDefinition(network.name, contract);
    assets.push({
      symbol: metadata.symbol,
      name: metadata.name,
      chain: network.name,
      phoneId: addressItem.phoneId,
      wallet: addressItem.wallet,
      amount: `${amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${metadata.symbol}`,
      change: nullableNumber(quote.change24),
      value: quote.price == null ? null : amount * quote.price,
      price: quote.price,
      priceSource: quote.source,
      quoteUrl: quote.url,
      color: stablecoin ? '#b8ff62' : '#53d5e7',
      source: 'auto-discovery',
      addressId: addressItem.id,
      tokenAddress: contract,
      tokenDecimals: metadata.decimals,
      stablecoin: Boolean(stablecoin)
    });
  }
  return { assets, mode: discovery.mode, error: discovery.error, truncated: Boolean(discovery.truncated), scannedFrom: discovery.scannedFrom, scannedThrough: discovery.scannedThrough };
}

async function discoverSolanaTokenAssets(addressItem, network, runLimited) {
  const accounts = [];
  const errors = [];
  for (const programId of SOLANA_TOKEN_PROGRAMS) {
    try {
      const result = await runLimited(network.name, () => rpcCall(network.rpc, 'getTokenAccountsByOwner', [addressItem.address, { programId }, { encoding: 'jsonParsed', commitment: 'confirmed' }]));
      accounts.push(...(Array.isArray(result?.value) ? result.value : []));
    } catch (error) { errors.push(error.message); }
  }
  const byMint = new Map();
  for (const account of accounts) {
    const info = account?.account?.data?.parsed?.info;
    const mint = String(info?.mint || '');
    const tokenAmount = info?.tokenAmount;
    if (!mint || !tokenAmount) continue;
    const raw = safeBigInt(tokenAmount.amount);
    if (raw <= 0n) continue;
    const previous = byMint.get(mint) || { raw: 0n, decimals: Number(tokenAmount.decimals) };
    byMint.set(mint, { raw: previous.raw + raw, decimals: Number.isInteger(previous.decimals) ? previous.decimals : Number(tokenAmount.decimals) });
  }
  const assets = [];
  for (const [mint, balance] of byMint) {
    if (configuredToken(network, mint)) continue;
    const known = stablecoinDefinition(network.name, mint);
    const decimals = known?.decimals ?? (Number.isInteger(balance.decimals) ? balance.decimals : 6);
    const amountText = unitsFromBigInt(balance.raw, decimals);
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const quote = await getDexQuote(network, mint);
    const symbol = known?.symbol || `SPL-${mint.slice(0, 4).toUpperCase()}`;
    assets.push({
      symbol,
      name: known?.name || 'SPL Token',
      chain: network.name,
      phoneId: addressItem.phoneId,
      wallet: addressItem.wallet,
      amount: `${amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${symbol}`,
      change: nullableNumber(quote.change24),
      value: quote.price == null ? null : amount * quote.price,
      price: quote.price,
      priceSource: quote.source,
      quoteUrl: quote.url,
      color: known ? '#b8ff62' : '#53d5e7',
      source: 'auto-discovery',
      addressId: addressItem.id,
      tokenAddress: mint,
      tokenDecimals: decimals,
      stablecoin: Boolean(known)
    });
  }
  return { assets, mode: 'rpc-token-accounts', error: errors.length === SOLANA_TOKEN_PROGRAMS.length ? errors.join('; ') : null };
}

async function discoverTokenAssets(addressItem, network, runLimited, options = {}) {
  if (network.type === 'EVM') return discoverEvmTokenAssets(addressItem, network, runLimited, options);
  if (network.type === 'SVM') return discoverSolanaTokenAssets(addressItem, network, runLimited);
  return { assets: [], mode: 'unsupported', error: '该网络类型暂不支持自动发现代币' };
}

async function syncAddressGroup(item, networks, prices, runLimited, options = {}) {
  const targets = item.chain === 'EVM'
    ? networks.filter(network => network.type === 'EVM' && network.rpc)
    : networks.filter(network => network.name === item.chain && network.rpc);
  const syncedAt = new Date().toISOString();
  if (!targets.length) return { address: { ...item, status: 'error', error: '该网络未配置 RPC', syncedAt }, assets: [] };

  const pieces = await Promise.all(targets.map(network => runLimited(network.name, () => syncOneAddress(item, network, prices))));
  const nativeAssets = pieces.flatMap(piece => piece.asset ? [piece.asset] : []);
  const tokenPieces = await Promise.all(targets.map(network => discoverTokenAssets(item, network, runLimited, options).catch(error => ({ assets: [], mode: 'error', error: error.message }))));
  const assets = [...nativeAssets, ...tokenPieces.flatMap(piece => piece.assets || [])];
  const errors = Object.fromEntries(pieces.filter(piece => piece.error).map(piece => [piece.network, piece.error]));
  const status = nativeAssets.length === targets.length ? 'synced' : nativeAssets.length ? 'partial' : 'error';
  return {
    address: {
      ...item,
      status,
      syncedAt,
      nativeBalance: item.chain === 'EVM' ? null : pieces[0]?.address.nativeBalance ?? null,
      nativeBalances: item.chain === 'EVM' ? Object.fromEntries(nativeAssets.map(asset => [asset.chain, asset.amount])) : undefined,
      syncedChains: nativeAssets.length,
      totalChains: targets.length,
      error: status === 'synced' ? null : status === 'partial' ? `${Object.keys(errors).length} 条链同步失败` : Object.values(errors)[0] || '同步失败',
      errors: Object.keys(errors).length ? errors : undefined,
      tokenDiscovery: {
        discovered: tokenPieces.reduce((sum, piece) => sum + (piece.assets || []).length, 0),
        modes: [...new Set(tokenPieces.map(piece => piece.mode).filter(Boolean))],
        errors: Object.fromEntries(tokenPieces.map((piece, index) => [targets[index].name, piece.error]).filter(([, error]) => error)),
        truncated: tokenPieces.some(piece => piece.truncated),
        incompleteChains: tokenPieces.map((piece, index) => (piece.error || piece.truncated) ? targets[index].name : null).filter(Boolean),
        scannedThrough: Object.fromEntries(tokenPieces.map((piece, index) => [targets[index]?.name || String(index), piece.scannedThrough]).filter(([, block]) => Number.isFinite(block)))
      }
    },
    assets
  };
}

async function syncCustomTokenBalance(token, addressItem, network, runLimited) {
  let amount;
  if (network.type === 'SVM') {
    const result = await runLimited(network.name, () => rpcCall(network.rpc, 'getTokenAccountsByOwner', [addressItem.address, { mint: token.contract }, { encoding: 'jsonParsed', commitment: 'confirmed' }]));
    amount = (result.value || []).reduce((sum, account) => {
      const tokenAmount = account.account?.data?.parsed?.info?.tokenAmount || {};
      const uiAmount = Number(tokenAmount.uiAmountString);
      if (Number.isFinite(uiAmount)) return sum + uiAmount;
      const rawAmount = Number(tokenAmount.amount);
      const decimals = Number(tokenAmount.decimals ?? token.decimals);
      return Number.isFinite(rawAmount) && Number.isFinite(decimals) ? sum + rawAmount / 10 ** decimals : sum;
    }, 0);
  } else {
    const owner = addressItem.address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const result = await runLimited(network.name, () => rpcCall(network.rpc, 'eth_call', [{ to: token.contract, data: `0x70a08231${owner}` }, 'latest']));
    amount = Number(unitsFromBigInt(BigInt(result || '0x0'), token.decimals));
  }
  return amount;
}

async function syncCustomToken(token, selectedAddresses, networks, runLimited) {
  const network = networks.find(item => item.name === token.chain);
  const syncedAt = new Date().toISOString();
  if (!network) return { token: { ...token, status: 'error', error: '区块链不存在', syncedAt }, assets: [] };
  const targets = selectedAddresses.filter(item => addressSupportsNetwork(item, network));
  const quote = token.priceMode === 'manual'
    ? { price: Number(token.manualPrice || 0), change24: null, liquidityUsd: null, source: 'manual', url: null, quotedAt: syncedAt, error: null }
    : await getDexQuote(network, token.contract);
  const balances = await Promise.all(targets.map(async addressItem => {
    try { return { addressItem, amount: await syncCustomTokenBalance(token, addressItem, network, runLimited), error: null }; }
    catch (error) { return { addressItem, amount: 0, error: error.message }; }
  }));
  const errors = balances.filter(item => item.error);
  const assets = balances.filter(item => !item.error && item.amount > 0).map(({ addressItem, amount }) => ({
    symbol: token.symbol,
    name: token.name,
    chain: token.chain,
    phoneId: addressItem.phoneId,
    wallet: addressItem.wallet,
    amount: `${amount.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${token.symbol}`,
    change: nullableNumber(quote.change24),
    value: quote.price == null ? null : amount * quote.price,
    price: quote.price,
    priceSource: quote.source,
    quoteUrl: quote.url,
    color: '#53d5e7',
    source: 'custom-token',
    addressId: addressItem.id,
    customTokenId: token.id
  }));
  const status = errors.length === targets.length && targets.length ? 'error' : errors.length ? 'partial' : 'synced';
  return {
    token: {
      ...token,
      status,
      error: errors.length ? `${errors.length}/${targets.length} 个地址查询失败` : null,
      scannedAddressCount: targets.length,
      holderCount: assets.length,
      price: quote.price,
      change24: quote.change24,
      liquidityUsd: quote.liquidityUsd,
      quoteSource: quote.source,
      quoteUrl: quote.url,
      quoteError: quote.error,
      quotedAt: quote.quotedAt || null,
      syncedAt
    },
    assets
  };
}

function addressesForScope(options = {}) {
  const scope = options.scope || 'all';
  if (scope === 'all') return state.addresses;
  if (scope === 'manager') {
    const phoneIds = new Set(state.phones.filter(phone => phone.managerId === options.managerId).map(phone => phone.id));
    return state.addresses.filter(item => phoneIds.has(item.phoneId));
  }
  if (scope === 'phone') return state.addresses.filter(item => item.phoneId === options.phoneId);
  if (scope === 'wallet') return state.addresses.filter(item => item.phoneId === options.phoneId && item.wallet === Number(options.wallet));
  if (scope === 'addressIds') {
    const ids = new Set(options.addressIds || []);
    return state.addresses.filter(item => ids.has(item.id));
  }
  return [];
}

function scopeLabel(options = {}) {
  if (options.scope === 'manager') return `管理人 ${options.managerId}`;
  if (options.scope === 'phone') return `手机 ${options.phoneId}`;
  if (options.scope === 'wallet') {
    const wallet = Number(options.wallet);
    return `${options.phoneId} / ${state.walletNames[`${options.phoneId}:${wallet}`] || `OKX 钱包 ${wallet}`}`;
  }
  if (options.scope === 'addressIds') return '随机自动批次';
  return '全部账户';
}

async function runSync(options = {}) {
  const userId = requestContext.getStore()?.user?.id;
  if (!userId) throw new Error('缺少同步用户上下文');
  const existing = syncPromises.get(userId);
  if (existing) return existing.then(() => runSync(options));
  let selectedAddressIds = [];
  const syncPromise = (async () => {
    const selectedAddresses = addressesForScope(options);
    const requestedDeepDiscovery = options.deepDiscovery === true || options.deepDiscovery === 'true';
    // Targeted syncs are deliberate requests for a small scope. Automatically
    // scan the full Transfer history there so older tokens are not hidden by a
    // public RPC's recent-log window. Full-account syncs remain bounded unless
    // the user explicitly enables deep discovery.
    const targetedDeepDiscovery = !requestedDeepDiscovery && options.scope && options.scope !== 'all';
    const syncOptions = { ...options, deepDiscovery: requestedDeepDiscovery || targetedDeepDiscovery };
    selectedAddressIds = selectedAddresses.map(item => item.id);
    state.sync = { status: 'running', startedAt: new Date().toISOString(), finishedAt: null, error: null, scope: options.scope || 'all', scopeLabel: scopeLabel(options), addressCount: selectedAddresses.length, deepDiscovery: syncOptions.deepDiscovery };
    await saveState();
    const networks = networksForSync();
    const prices = await getPrices(networks);
    const runLimited = createKeyedLimiter(CONCURRENCY_PER_CHAIN);
    const selectedTokens = state.customTokens.filter(token => {
      const network = networks.find(item => item.name === token.chain);
      return network && selectedAddresses.some(address => addressSupportsNetwork(address, network));
    });
    const results = await Promise.all(selectedAddresses.map(item => syncAddressGroup(item, networks, prices, runLimited, syncOptions)));
    const tokenResults = await Promise.all(selectedTokens.map(token => syncCustomToken(token, selectedAddresses, networks, runLimited)));
    const addressResults = new Map(results.map(result => [result.address.id, result.address]));
    const customTokenResults = new Map(tokenResults.map(result => [result.token.id, result.token]));
    const completedAt = Date.now();
    state.addresses = state.addresses.map(item => {
      const refreshed = addressResults.get(item.id);
      return refreshed ? { ...refreshed, nextSyncAt: randomRefreshAt(completedAt) } : item;
    });
    state.customTokens = state.customTokens.map(item => customTokenResults.get(item.id) || item);
    const refreshedAddressIds = new Set(results.map(result => result.address.id));
    const refreshedKeys = new Set(results.flatMap(result => result.assets.map(asset => `${asset.phoneId}|${asset.wallet}|${asset.chain}`)));
    const incompleteDiscoveryKeys = new Set(results.flatMap(result => (result.address.tokenDiscovery?.incompleteChains || []).map(chain => `${result.address.id}|${chain}`)));
    state.assets = state.assets.filter(asset => {
      if (refreshedAddressIds.has(asset.addressId)) return asset.source === 'auto-discovery' && incompleteDiscoveryKeys.has(`${asset.addressId}|${asset.chain}`);
      return asset.addressId == null && refreshedKeys.has(`${asset.phoneId}|${asset.wallet}|${asset.chain}`) ? false : true;
    }).map(asset => incompleteDiscoveryKeys.has(`${asset.addressId}|${asset.chain}`) && asset.source === 'auto-discovery'
      ? { ...asset, stale: true, staleAt: new Date().toISOString() }
      : asset);
    for (const result of results) state.assets.push(...result.assets);
    for (const result of tokenResults) state.assets.push(...result.assets);
    state.lastSync = completedAt;
    state.scheduler = { ...state.scheduler, nextBatchAt: nextBatchSchedule(state.addresses, state.scheduler?.nextCheckAt || null) };
    recordNetWorthSnapshot(state.lastSync);
    state.sync = { ...state.sync, status: 'idle', finishedAt: new Date().toISOString(), error: null };
    await saveState();
    return state;
  })().catch(async error => {
    const failedIds = new Set(selectedAddressIds);
    const failedAt = Date.now();
    state.addresses = state.addresses.map(item => failedIds.has(item.id) ? { ...item, nextSyncAt: randomRefreshAt(failedAt) } : item);
    state.scheduler = { ...state.scheduler, nextBatchAt: nextBatchSchedule(state.addresses, state.scheduler?.nextCheckAt || null) };
    state.sync = { ...state.sync, status: 'error', finishedAt: new Date().toISOString(), error: error.message };
    await saveState();
    throw error;
  }).finally(() => { syncPromises.delete(userId); });
  syncPromises.set(userId, syncPromise);
  return syncPromise;
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json(response, 200, { ok: true, service: 'chainfolio-backend', version: appVersion, uptime: process.uptime(), sync: state.sync, scheduler: state.scheduler, indexers: { etherscan: Boolean(ETHERSCAN_API_KEY), blockscoutNetworks: networkCatalog.filter(network => network.blockscoutApi).map(network => network.name) }, counts: { managers: state.managers.length, phones: state.phones.length, addresses: state.addresses.length } });
  }
  if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, { ...state, currentUser: publicUser(requestContext.getStore().user) });
  if (request.method === 'POST' && url.pathname === '/api/sync') {
    try {
      const syncOptions = await readJson(request);
      const selected = addressesForScope(syncOptions);
      if (!selected.length) return json(response, 400, { error: '所选范围内没有可更新的地址' });
      return json(response, 200, await runSync(syncOptions));
    } catch (error) { return json(response, 502, { error: error.message }); }
  }

  const body = ['POST', 'PATCH'].includes(request.method) ? await readJson(request) : {};
  if (request.method === 'POST' && url.pathname === '/api/managers') {
    const name = String(body.name || '').trim();
    if (!name) return json(response, 400, { error: '管理人姓名不能为空' });
    if (state.managers.some(item => item.name.toLowerCase() === name.toLowerCase())) return json(response, 409, { error: '管理人已存在' });
    const colors = ['#53d5e7', '#ffbd66', '#ff7d7d', '#65d99a', '#9188ff'];
    state.managers.push({ id: nextId(state.managers, 'M'), name, color: colors[state.managers.length % colors.length] });
  } else if (request.method === 'PATCH' && /^\/api\/managers\/[^/]+$/.test(url.pathname)) {
    const managerId = decodeURIComponent(url.pathname.split('/')[3]);
    const manager = state.managers.find(item => item.id === managerId);
    const name = String(body.name || '').trim();
    if (!manager) return json(response, 404, { error: '管理人不存在' });
    if (!name) return json(response, 400, { error: '管理人姓名不能为空' });
    if (state.managers.some(item => item.id !== managerId && item.name.toLowerCase() === name.toLowerCase())) return json(response, 409, { error: '管理人姓名已存在' });
    manager.name = name;
  } else if (request.method === 'DELETE' && /^\/api\/managers\/[^/]+$/.test(url.pathname)) {
    const managerId = decodeURIComponent(url.pathname.split('/')[3]);
    if (!state.managers.some(item => item.id === managerId)) return json(response, 404, { error: '管理人不存在' });
    if (state.phones.some(phone => phone.managerId === managerId)) return json(response, 409, { error: '该管理人名下还有手机，请先重新分配手机' });
    state.managers = state.managers.filter(item => item.id !== managerId);
  } else if (request.method === 'POST' && url.pathname === '/api/wallet-activities') {
    const name = String(body.name || '').trim();
    if (!name || name.length > 40) return json(response, 400, { error: '活动名称应为 1—40 个字符' });
    if (state.walletActivityTemplates.some(item => item.name.toLowerCase() === name.toLowerCase())) return json(response, 409, { error: '该活动已经存在' });
    if (state.walletActivityTemplates.length >= 30) return json(response, 409, { error: '最多创建 30 个通用活动' });
    const fields = normalizeActivityFields(body.fields);
    if (!fields.length) return json(response, 400, { error: '请至少保留一个管理字段' });
    state.walletActivityTemplates.push({ id: nextId(state.walletActivityTemplates, 'ACT'), name, description: String(body.description || '').trim().slice(0, 160), fields, createdAt: new Date().toISOString(), archived: false });
  } else if (request.method === 'PATCH' && /^\/api\/wallet-activities\/[^/]+$/.test(url.pathname)) {
    const activityId = decodeURIComponent(url.pathname.split('/')[3]);
    const activity = state.walletActivityTemplates.find(item => item.id === activityId);
    if (!activity) return json(response, 404, { error: '活动不存在' });
    if (body.name != null) {
      const name = String(body.name || '').trim();
      if (!name || name.length > 40) return json(response, 400, { error: '活动名称应为 1—40 个字符' });
      if (state.walletActivityTemplates.some(item => item.id !== activityId && item.name.toLowerCase() === name.toLowerCase())) return json(response, 409, { error: '该活动名称已经存在' });
      activity.name = name;
    }
    if (body.description != null) activity.description = String(body.description || '').trim().slice(0, 160);
    if (body.fields != null) {
      const fields = normalizeActivityFields(body.fields);
      if (!fields.length) return json(response, 400, { error: '请至少保留一个管理字段' });
      activity.fields = fields;
      for (const [walletKey, activities] of Object.entries(state.walletActivityStatuses)) {
        if (!activities?.[activityId]) continue;
        const record = normalizeActivityRecord(activity, activities[activityId]);
        if (Object.keys(record).length) activities[activityId] = record; else delete activities[activityId];
        if (!Object.keys(activities).length) delete state.walletActivityStatuses[walletKey];
      }
    }
    if (body.archived != null) activity.archived = Boolean(body.archived);
  } else if (request.method === 'DELETE' && /^\/api\/wallet-activities\/[^/]+$/.test(url.pathname)) {
    const activityId = decodeURIComponent(url.pathname.split('/')[3]);
    if (!state.walletActivityTemplates.some(item => item.id === activityId)) return json(response, 404, { error: '活动不存在' });
    state.walletActivityTemplates = state.walletActivityTemplates.filter(item => item.id !== activityId);
    for (const walletKey of Object.keys(state.walletActivityStatuses)) {
      delete state.walletActivityStatuses[walletKey][activityId];
      if (!Object.keys(state.walletActivityStatuses[walletKey]).length) delete state.walletActivityStatuses[walletKey];
    }
  } else if (request.method === 'POST' && url.pathname === '/api/wallets/bulk-status') {
    const walletKeys = [...new Set(Array.isArray(body.walletKeys) ? body.walletKeys.map(value => String(value)) : [])].slice(0, 500);
    const field = String(body.field || ''); const value = String(body.value || '');
    const validWalletKeys = walletKeys.filter(walletKey => {
      const [phoneId, walletText] = walletKey.split(':'); const wallet = Number(walletText);
      return state.phones.some(phone => phone.id === phoneId) && Number.isInteger(wallet) && wallet >= 1 && wallet <= Number(state.walletCounts[phoneId] || 0);
    });
    if (!validWalletKeys.length) return json(response, 400, { error: '请至少选择一个有效钱包' });
    if (field === 'sybilStatus') {
      if (!['unreviewed', 'pending', 'normal', 'suspected', 'confirmed'].includes(value)) return json(response, 400, { error: '女巫检查状态无效' });
      for (const walletKey of validWalletKeys) {
        const metadata = state.walletMetadata[walletKey] || { createdAt: '', note: '' };
        state.walletMetadata[walletKey] = { ...metadata, sybilStatus: value, updatedAt: new Date().toISOString() };
      }
    } else if (field.startsWith('activity:')) {
      const [, activityId, fieldId] = field.split(':');
      const activity = state.walletActivityTemplates.find(item => item.id === activityId);
      if (!activity) return json(response, 404, { error: '管理模板不存在' });
      const activityField = activity.fields.find(item => item.id === (fieldId || 'status'));
      if (!activityField) return json(response, 404, { error: '管理字段不存在' });
      const normalizedValue = normalizeActivityValue(activityField, body.value);
      if (activityField.type === 'select' && body.value !== '' && normalizedValue === '') return json(response, 400, { error: '字段选项无效' });
      for (const walletKey of validWalletKeys) {
        const statuses = { ...(state.walletActivityStatuses[walletKey] || {}) };
        const record = { ...(statuses[activityId] && typeof statuses[activityId] === 'object' ? statuses[activityId] : normalizeActivityRecord(activity, statuses[activityId])) };
        if (normalizedValue === '' || normalizedValue === false) delete record[activityField.id]; else record[activityField.id] = normalizedValue;
        if (Object.keys(record).length) statuses[activityId] = record; else delete statuses[activityId];
        if (Object.keys(statuses).length) state.walletActivityStatuses[walletKey] = statuses; else delete state.walletActivityStatuses[walletKey];
      }
    } else return json(response, 400, { error: '批量修改字段无效' });
  } else if (request.method === 'POST' && url.pathname === '/api/phones') {
    const name = String(body.name || '').trim();
    if (!name || !state.managers.some(item => item.id === body.managerId)) return json(response, 400, { error: '手机名称或管理人无效' });
    const phone = { id: nextId(state.phones, 'P'), name, managerId: body.managerId };
    state.phones.push(phone); state.walletCounts[phone.id] = 3;
  } else if (request.method === 'PATCH' && /^\/api\/phones\/[^/]+$/.test(url.pathname)) {
    const phoneId = decodeURIComponent(url.pathname.split('/')[3]);
    const phone = state.phones.find(item => item.id === phoneId);
    const name = String(body.name || '').trim();
    if (!phone) return json(response, 404, { error: '手机不存在' });
    if (!name || !state.managers.some(item => item.id === body.managerId)) return json(response, 400, { error: '手机名称或管理人无效' });
    phone.name = name; phone.managerId = body.managerId;
  } else if (request.method === 'DELETE' && /^\/api\/phones\/[^/]+$/.test(url.pathname)) {
    const phoneId = decodeURIComponent(url.pathname.split('/')[3]);
    if (!state.phones.some(item => item.id === phoneId)) return json(response, 404, { error: '手机不存在' });
    state.phones = state.phones.filter(item => item.id !== phoneId);
    state.addresses = state.addresses.filter(item => item.phoneId !== phoneId);
    state.scheduler = { ...state.scheduler, nextBatchAt: nextAddressSchedule(state.addresses) };
    state.assets = state.assets.filter(item => item.phoneId !== phoneId);
    delete state.walletCounts[phoneId];
    for (const key of Object.keys(state.walletNames)) if (key.startsWith(`${phoneId}:`)) delete state.walletNames[key];
    for (const key of Object.keys(state.walletMetadata)) if (key.startsWith(`${phoneId}:`)) delete state.walletMetadata[key];
    for (const key of Object.keys(state.walletActivityStatuses)) if (key.startsWith(`${phoneId}:`)) delete state.walletActivityStatuses[key];
  } else if (request.method === 'PATCH' && /^\/api\/phones\/[^/]+\/manager$/.test(url.pathname)) {
    const phoneId = url.pathname.split('/')[3];
    const phone = state.phones.find(item => item.id === phoneId);
    if (!phone || !state.managers.some(item => item.id === body.managerId)) return json(response, 404, { error: '手机或管理人不存在' });
    phone.managerId = body.managerId;
  } else if (request.method === 'POST' && /^\/api\/phones\/[^/]+\/wallets$/.test(url.pathname)) {
    const phoneId = url.pathname.split('/')[3];
    if (!state.phones.some(item => item.id === phoneId)) return json(response, 404, { error: '手机不存在' });
    const current = Math.min(10, Math.max(1, Number(state.walletCounts[phoneId]) || 3));
    if (current >= 10) return json(response, 409, { error: '每台手机最多 10 个钱包' });
    state.walletCounts[phoneId] = current + 1;
    state.walletMetadata[`${phoneId}:${current + 1}`] = { createdAt: '', sybilStatus: 'unreviewed', note: '', updatedAt: null };
  } else if (request.method === 'PATCH' && /^\/api\/phones\/[^/]+\/wallets\/\d+$/.test(url.pathname)) {
    const [, , , phoneId, , walletText] = url.pathname.split('/');
    const wallet = Number(walletText); const count = Number(state.walletCounts[phoneId] || 0);
    const name = String(body.name || '').trim();
    const existingMetadata = state.walletMetadata[`${phoneId}:${wallet}`] || {};
    const createdAt = body.createdAt == null ? String(existingMetadata.createdAt || '') : String(body.createdAt || '').trim();
    const sybilStatus = body.sybilStatus == null ? String(existingMetadata.sybilStatus || 'unreviewed') : String(body.sybilStatus);
    const note = body.note == null ? String(existingMetadata.note || '') : String(body.note || '').trim();
    const activityStatuses = body.activityStatuses && typeof body.activityStatuses === 'object' ? body.activityStatuses : null;
    const activityValues = body.activityValues && typeof body.activityValues === 'object' ? body.activityValues : null;
    if (!state.phones.some(item => item.id === phoneId) || wallet < 1 || wallet > count) return json(response, 404, { error: '钱包不存在' });
    if (!name) return json(response, 400, { error: '钱包名称不能为空' });
    if (createdAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(createdAt)) return json(response, 400, { error: '钱包生成时间格式不正确' });
    if (!['unreviewed', 'pending', 'normal', 'suspected', 'confirmed'].includes(sybilStatus)) return json(response, 400, { error: '女巫状态无效' });
    if (note.length > 200) return json(response, 400, { error: '钱包备注最多 200 个字符' });
    state.walletNames[`${phoneId}:${wallet}`] = name;
    state.walletMetadata[`${phoneId}:${wallet}`] = { createdAt, sybilStatus, note, updatedAt: new Date().toISOString() };
    if (activityStatuses || activityValues) {
      const templatesById = new Map(state.walletActivityTemplates.map(item => [item.id, item]));
      const nextStatuses = { ...(state.walletActivityStatuses[`${phoneId}:${wallet}`] || {}) };
      for (const [activityId, status] of Object.entries(activityStatuses || {})) {
        const template = templatesById.get(activityId);
        if (!template) continue;
        const legacyField = template.fields.find(field => field.id === 'status') || template.fields[0];
        if (!legacyField) continue;
        const record = { ...(nextStatuses[activityId] && typeof nextStatuses[activityId] === 'object' ? nextStatuses[activityId] : normalizeActivityRecord(template, nextStatuses[activityId])) };
        const normalizedValue = normalizeActivityValue(legacyField, status);
        if (normalizedValue === '' || normalizedValue === false) delete record[legacyField.id]; else record[legacyField.id] = normalizedValue;
        if (Object.keys(record).length) nextStatuses[activityId] = record; else delete nextStatuses[activityId];
      }
      for (const [activityId, values] of Object.entries(activityValues || {})) {
        const template = templatesById.get(activityId);
        if (!template || !values || typeof values !== 'object') continue;
        const record = { ...(nextStatuses[activityId] && typeof nextStatuses[activityId] === 'object' ? nextStatuses[activityId] : normalizeActivityRecord(template, nextStatuses[activityId])) };
        for (const field of template.fields) {
          if (!(field.id in values)) continue;
          const normalizedValue = normalizeActivityValue(field, values[field.id]);
          if (normalizedValue === '' || normalizedValue === false) delete record[field.id]; else record[field.id] = normalizedValue;
        }
        if (Object.keys(record).length) nextStatuses[activityId] = record; else delete nextStatuses[activityId];
      }
      if (Object.keys(nextStatuses).length) state.walletActivityStatuses[`${phoneId}:${wallet}`] = nextStatuses;
      else delete state.walletActivityStatuses[`${phoneId}:${wallet}`];
    }
  } else if (request.method === 'DELETE' && /^\/api\/phones\/[^/]+\/wallets\/\d+$/.test(url.pathname)) {
    const [, , , phoneId, , walletText] = url.pathname.split('/');
    const wallet = Number(walletText); const count = Number(state.walletCounts[phoneId] || 0);
    if (!state.phones.some(item => item.id === phoneId) || wallet < 1 || wallet > count) return json(response, 404, { error: '钱包不存在' });
    if (count <= 1) return json(response, 409, { error: '手机至少保留 1 个钱包；如不再使用可删除手机' });
    state.addresses = state.addresses.filter(item => !(item.phoneId === phoneId && item.wallet === wallet)).map(item => item.phoneId === phoneId && item.wallet > wallet ? { ...item, wallet: item.wallet - 1 } : item);
    state.scheduler = { ...state.scheduler, nextBatchAt: nextAddressSchedule(state.addresses) };
    state.assets = state.assets.filter(item => !(item.phoneId === phoneId && item.wallet === wallet)).map(item => item.phoneId === phoneId && item.wallet > wallet ? { ...item, wallet: item.wallet - 1 } : item);
    const nextNames = {};
    for (const [key, value] of Object.entries(state.walletNames)) {
      const [keyPhone, keyWalletText] = key.split(':'); const keyWallet = Number(keyWalletText);
      if (keyPhone !== phoneId) nextNames[key] = value;
      else if (keyWallet < wallet) nextNames[key] = value;
      else if (keyWallet > wallet) nextNames[`${phoneId}:${keyWallet - 1}`] = value;
    }
    const nextMetadata = {};
    for (const [key, value] of Object.entries(state.walletMetadata)) {
      const [keyPhone, keyWalletText] = key.split(':'); const keyWallet = Number(keyWalletText);
      if (keyPhone !== phoneId) nextMetadata[key] = value;
      else if (keyWallet < wallet) nextMetadata[key] = value;
      else if (keyWallet > wallet) nextMetadata[`${phoneId}:${keyWallet - 1}`] = value;
    }
    const nextActivityStatuses = {};
    for (const [key, value] of Object.entries(state.walletActivityStatuses)) {
      const [keyPhone, keyWalletText] = key.split(':'); const keyWallet = Number(keyWalletText);
      if (keyPhone !== phoneId) nextActivityStatuses[key] = value;
      else if (keyWallet < wallet) nextActivityStatuses[key] = value;
      else if (keyWallet > wallet) nextActivityStatuses[`${phoneId}:${keyWallet - 1}`] = value;
    }
    state.walletNames = nextNames; state.walletMetadata = nextMetadata; state.walletActivityStatuses = nextActivityStatuses; state.walletCounts[phoneId] = count - 1;
  } else if (request.method === 'POST' && url.pathname === '/api/addresses') {
    const phone = state.phones.find(item => item.id === body.phoneId);
    const wallet = Number(body.wallet);
    const chain = String(body.chain || '').trim();
    const address = String(body.address || '').trim();
    if (!phone || wallet < 1 || wallet > Number(state.walletCounts[phone.id]) || !chain || !address) return json(response, 400, { error: '地址归属信息不完整' });
    if (isDuplicateAddress(address, chain)) return json(response, 409, { error: isEvmChain(chain) ? '该 EVM 地址已经导入' : '该链地址已经导入' });
    state.addresses.push({ id: nextId(state.addresses, 'AD'), phoneId: phone.id, wallet, chain, address, status: 'pending', nextSyncAt: randomRefreshAt() });
    state.scheduler = { ...state.scheduler, nextBatchAt: nextAddressSchedule(state.addresses) };
  } else if (request.method === 'PATCH' && /^\/api\/addresses\/[^/]+$/.test(url.pathname)) {
    const addressId = decodeURIComponent(url.pathname.split('/')[3]);
    const item = state.addresses.find(entry => entry.id === addressId);
    const phone = state.phones.find(entry => entry.id === body.phoneId);
    const wallet = Number(body.wallet); const chain = String(body.chain || '').trim(); const address = String(body.address || '').trim();
    if (!item) return json(response, 404, { error: '地址记录不存在' });
    if (!phone || wallet < 1 || wallet > Number(state.walletCounts[phone.id]) || !chain || !address) return json(response, 400, { error: '地址归属信息不完整' });
    if (isDuplicateAddress(address, chain, addressId)) return json(response, 409, { error: isEvmChain(chain) ? '该 EVM 地址已经导入' : '该链地址已经导入' });
    const oldTargetChains = new Set(addressTargetChains(item));
    state.assets = state.assets.filter(asset => asset.addressId !== addressId && !(asset.addressId == null && asset.phoneId === item.phoneId && asset.wallet === item.wallet && oldTargetChains.has(asset.chain)));
    Object.assign(item, { phoneId: phone.id, wallet, chain, address, status: 'pending', error: null, nativeBalance: null, syncedAt: null, nextSyncAt: randomRefreshAt() });
    state.scheduler = { ...state.scheduler, nextBatchAt: nextAddressSchedule(state.addresses) };
  } else if (request.method === 'DELETE' && /^\/api\/addresses\/[^/]+$/.test(url.pathname)) {
    const addressId = decodeURIComponent(url.pathname.split('/')[3]);
    const item = state.addresses.find(entry => entry.id === addressId);
    if (!item) return json(response, 404, { error: '地址记录不存在' });
    state.addresses = state.addresses.filter(entry => entry.id !== addressId);
    state.scheduler = { ...state.scheduler, nextBatchAt: nextAddressSchedule(state.addresses) };
    const targetChains = new Set(addressTargetChains(item));
    state.assets = state.assets.filter(asset => asset.addressId !== addressId && !(asset.addressId == null && asset.phoneId === item.phoneId && asset.wallet === item.wallet && targetChains.has(asset.chain)));
  } else if (request.method === 'POST' && url.pathname === '/api/tokens/detect') {
    try { return json(response, 200, await detectTokenMetadata(body)); }
    catch (error) { return json(response, 400, { error: error.message }); }
  } else if (request.method === 'POST' && url.pathname === '/api/tokens') {
    const validated = validateCustomToken(body);
    if (validated.error) return json(response, validated.status || 400, { error: validated.error });
    if (!validated.existing) state.customTokens.push({ id: nextId(state.customTokens, 'CT'), ...validated.token, status: 'pending' });
  } else if (request.method === 'PATCH' && /^\/api\/tokens\/[^/]+$/.test(url.pathname)) {
    const tokenId = decodeURIComponent(url.pathname.split('/')[3]);
    const item = state.customTokens.find(token => token.id === tokenId);
    if (item?.system) return json(response, 409, { error: '系统稳定币由系统自动维护，不能编辑' });
    if (!item) return json(response, 404, { error: '自定义币种不存在' });
    const validated = validateCustomToken(body, tokenId);
    if (validated.error) return json(response, validated.status || 400, { error: validated.error });
    state.assets = state.assets.filter(asset => asset.customTokenId !== tokenId);
    Object.assign(item, validated.token, { status: 'pending', error: null, quoteError: null, syncedAt: null });
  } else if (request.method === 'DELETE' && /^\/api\/tokens\/[^/]+$/.test(url.pathname)) {
    const tokenId = decodeURIComponent(url.pathname.split('/')[3]);
    const token = state.customTokens.find(item => item.id === tokenId);
    if (!token) return json(response, 404, { error: '自定义币种不存在' });
    if (token.system) return json(response, 409, { error: '系统稳定币已自动启用，不能删除；如需补充其他代币，请使用自定义 Token' });
    state.customTokens = state.customTokens.filter(token => token.id !== tokenId);
    state.assets = state.assets.filter(asset => asset.customTokenId !== tokenId);
  } else if (request.method === 'POST' && url.pathname === '/api/networks') {
    const network = { name: String(body.name || '').trim(), symbol: String(body.symbol || '').trim().toUpperCase(), chainId: String(body.chainId || '').trim(), rpc: String(body.rpc || '').trim(), type: 'EVM', decimals: 18 };
    if (!network.name || !network.symbol || !network.chainId || !/^https:\/\//.test(network.rpc)) return json(response, 400, { error: '网络配置不完整' });
    if (networksForSync().some(item => item.name.toLowerCase() === network.name.toLowerCase() || String(item.chainId || '') === network.chainId)) return json(response, 409, { error: '网络名称或 Chain ID 已存在' });
    state.customNetworks.push(network);
  } else {
    return json(response, 404, { error: 'API 路径不存在' });
  }
  await saveState();
  return json(response, 200, state);
}

if (process.argv[2] === 'hash-password') {
  const password = process.argv[3];
  if (!validPassword(password)) throw new Error('密码需为 10–128 个字符');
  console.log(await hashPassword(password));
  process.exit(0);
}

await loadStore();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/api/healthz') return json(response, 200, {
      ok: true,
      service: 'chainfolio-backend',
      version: appVersion,
      indexers: {
        etherscan: Boolean(ETHERSCAN_API_KEY),
        blockscoutNetworks: networkCatalog.filter(network => network.blockscoutApi).map(network => network.name)
      },
      discovery: {
        maxTokens: TOKEN_DISCOVERY_MAX_TOKENS,
        maxLogs: TOKEN_DISCOVERY_MAX_LOGS,
        historyBlocks: TOKEN_DISCOVERY_HISTORY_BLOCKS,
        fullHistory: TOKEN_DISCOVERY_FULL_HISTORY
      }
    });
    if (url.pathname.startsWith('/api/setup/')) return await handleSetupApi(request, response, url);
    if (url.pathname.startsWith('/api/auth/')) return await handleAuthApi(request, response, url);
    if (url.pathname.startsWith('/api/')) {
      const session = readSession(request);
      if (!session) return json(response, 401, { error: '请先登录' });
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !requireCsrf(request, session)) return json(response, 403, { error: '页面会话已失效，请刷新后重试' });
      if (url.pathname.startsWith('/api/admin/')) return await handleAdminApi(request, response, url, session);
      const portfolio = store.portfolios[session.user.id] ||= emptyState();
      return await requestContext.run({ user: session.user, portfolio }, () => handleApi(request, response, url));
    }
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '');
    const file = normalize(join(publicRoot, relative));
    if (!file.startsWith(normalize(publicRoot))) { response.writeHead(403); response.end('Forbidden'); return; }
    try {
      const content = await readFile(file);
      response.writeHead(200, {
        'content-type': types[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
      });
      response.end(content);
    } catch { response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Not found'); }
  } catch (error) { json(response, 500, { error: error.message }); }
});

server.listen(port, host, () => console.log(`Chainfolio backend: http://${host}:${port}`));

async function runScheduledBatch(nextCheckAt) {
  const now = Date.now();
  const due = shuffled(state.addresses.filter(item => !Number.isFinite(Date.parse(item.nextSyncAt)) || Date.parse(item.nextSyncAt) <= now));
  const batchLimit = Math.min(RANDOM_BATCH_MAX_ADDRESSES, due.length);
  const batchSize = batchLimit ? randomInt(1, batchLimit + 1) : 0;
  const selected = due.slice(0, batchSize);
  const remainingDue = due.slice(batchSize);
  state.scheduler = {
    ...state.scheduler,
    mode: 'random',
    minIntervalHours: RANDOM_REFRESH_MIN_HOURS,
    maxIntervalHours: RANDOM_REFRESH_MAX_HOURS,
    checkIntervalMinutes: `${RANDOM_CHECK_MIN_MINUTES}-${RANDOM_CHECK_MAX_MINUTES}`,
    concurrencyPerChain: CONCURRENCY_PER_CHAIN,
    lastCheckAt: new Date(now).toISOString(),
    lastBatchSize: selected.length,
    nextCheckAt,
    nextBatchAt: remainingDue.length ? nextCheckAt : nextAddressSchedule(state.addresses, nextCheckAt)
  };
  if (!selected.length) { await saveState(); return; }
  await runSync({ scope: 'addressIds', addressIds: selected.map(item => item.id) });
  state.scheduler = {
    ...state.scheduler,
    lastBatchAt: new Date().toISOString(),
    lastBatchSize: selected.length,
    nextCheckAt,
    nextBatchAt: nextBatchSchedule(state.addresses, nextCheckAt)
  };
  await saveState();
}

async function runScheduledBatchesForAllUsers(nextCheckAt) {
  for (const user of store.users.filter(item => item.status === 'active')) {
    const portfolio = store.portfolios[user.id] ||= emptyState();
    await requestContext.run({ user, portfolio }, () => runScheduledBatch(nextCheckAt));
  }
}

function scheduleNextRandomBatch(delay = randomInt(30_000, 90_001)) {
  setTimeout(async () => {
    const nextDelay = randomCheckDelay();
    const nextCheckAt = new Date(Date.now() + nextDelay).toISOString();
    try { await runScheduledBatchesForAllUsers(nextCheckAt); }
    catch (error) { console.error('Random sync failed:', error.message); }
    scheduleNextRandomBatch(nextDelay);
  }, delay).unref();
}

scheduleNextRandomBatch();
