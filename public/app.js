const STORE = {
  addresses: 'chainfolio_addresses_v3',
  networks: 'chainfolio_networks_v1',
  managers: 'chainfolio_managers_v1',
  phones: 'chainfolio_phones_v1',
  phoneWalletCounts: 'chainfolio_phone_wallet_counts_v1',
  lastSync: 'chainfolio_last_sync_v1',
  fontScale: 'chainfolio_font_scale_v1',
  privacy: 'chainfolio_privacy_v1'
};
const defaultManagers = [
  { id: 'M-01', name: '张三', color: '#b8ff62' },
  { id: 'M-02', name: '李四', color: '#9188ff' }
];

const defaultPhones = Array.from({ length: 27 }, (_, index) => ({
  id: `P-${String(index + 1).padStart(2, '0')}`,
  name: `手机 ${String(index + 1).padStart(2, '0')}`,
  managerId: index < 18 ? 'M-01' : 'M-02'
}));

const builtInNetworks = [
  { name: 'Ethereum', symbol: 'ETH', type: 'EVM', color: '#6f7cff' },
  { name: 'Solana', symbol: 'SOL', type: 'SVM', color: '#8d6cff' },
  { name: 'Arbitrum', symbol: 'ARB', type: 'EVM', color: '#2e9bdb' },
  { name: 'Base', symbol: 'ETH', type: 'EVM', color: '#2677ff' },
  { name: 'Optimism', symbol: 'OP', type: 'EVM', color: '#ff4545' },
  { name: 'BNB Chain', symbol: 'BNB', type: 'EVM', color: '#f3ba2f' },
  { name: 'Robinhood Chain', symbol: 'ETH', type: 'EVM', color: '#00c805' },
  { name: 'X Layer', symbol: 'OKB', type: 'EVM', color: '#24282b' }
];

const defaultAddresses = [
  { id: 'AD-001', phoneId: 'P-01', wallet: 1, chain: 'BNB Chain', address: '0x4e2aB78fD52C981d9932D85E1A47B1097c03A41d', status: 'synced' },
  { id: 'AD-002', phoneId: 'P-01', wallet: 1, chain: 'Ethereum', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', status: 'synced' },
  { id: 'AD-003', phoneId: 'P-02', wallet: 2, chain: 'Solana', address: 'DTSnLQvMePLQqHnVJ6vAB2NZ6wdxNWpzdrBNN7fAYtM', status: 'synced' },
  { id: 'AD-004', phoneId: 'P-03', wallet: 1, chain: 'Arbitrum', address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', status: 'synced' },
  { id: 'AD-005', phoneId: 'P-05', wallet: 3, chain: 'Optimism', address: '0x47A7e8462167A3b6244bD6B0B24b9D201a0EF83D', status: 'synced' },
  { id: 'AD-006', phoneId: 'P-07', wallet: 2, chain: 'Base', address: '0x26C08A0fB17625C96A4E4a3A27fBDcF85D2f6251', status: 'synced' },
  { id: 'AD-007', phoneId: 'P-08', wallet: 3, chain: 'X Layer', address: '0x98B0aAE7C68dC4752D725489A08220B4a9c3d1F0', status: 'synced' },
  { id: 'AD-008', phoneId: 'P-10', wallet: 1, chain: 'Robinhood Chain', address: '0x1D3776B39Ad2186E244f36D60a2973904739fB74', status: 'synced' }
];

let assets = [
  { symbol: 'BNB', name: 'BNB', chain: 'BNB Chain', phoneId: 'P-01', wallet: 1, amount: '98.46 BNB', change: 2.34, value: 66488.12, color: '#f3ba2f' },
  { symbol: 'ETH', name: 'Ethereum', chain: 'Ethereum', phoneId: 'P-01', wallet: 1, amount: '18.426 ETH', change: 3.76, value: 57515.22, color: '#6f7cff' },
  { symbol: 'USDC', name: 'USD Coin', chain: 'Ethereum', phoneId: 'P-01', wallet: 1, amount: '24,580 USDC', change: 0.01, value: 24580.00, color: '#2775ca' },
  { symbol: 'SOL', name: 'Solana', chain: 'Solana', phoneId: 'P-02', wallet: 2, amount: '142.84 SOL', change: -1.28, value: 18340.66, color: '#8d6cff' },
  { symbol: 'USDT', name: 'Tether', chain: 'Arbitrum', phoneId: 'P-03', wallet: 1, amount: '8,240 USDT', change: 0.02, value: 8240.00, color: '#26a17b' },
  { symbol: 'ARB', name: 'Arbitrum', chain: 'Arbitrum', phoneId: 'P-03', wallet: 1, amount: '6,405 ARB', change: -2.16, value: 5828.55, color: '#2e9bdb' },
  { symbol: 'OP', name: 'Optimism', chain: 'Optimism', phoneId: 'P-05', wallet: 3, amount: '1,530 OP', change: 4.82, value: 2172.60, color: '#ff4545' },
  { symbol: 'AERO', name: 'Aerodrome', chain: 'Base', phoneId: 'P-07', wallet: 2, amount: '1,006 AERO', change: 6.12, value: 1086.48, color: '#2677ff' },
  { symbol: 'OKB', name: 'OKB', chain: 'X Layer', phoneId: 'P-08', wallet: 3, amount: '0.18 OKB', change: -0.64, value: 8.79, color: '#24282b' }
];

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

let managers = loadJson(STORE.managers, defaultManagers);
let phones = loadJson(STORE.phones, defaultPhones);
let addresses = loadJson(STORE.addresses, defaultAddresses);
let customNetworks = loadJson(STORE.networks, []);
let customTokens = [];
let phoneWalletCounts = loadJson(STORE.phoneWalletCounts, Object.fromEntries(phones.map(phone => [phone.id, 3])));
let walletNames = {};
let walletMetadata = {};
let walletActivityTemplates = [];
let walletActivityStatuses = {};
let lastSync = Number(localStorage.getItem(STORE.lastSync)) || Date.now();
let scheduler = { mode: 'random', minIntervalHours: 10, maxIntervalHours: 24, concurrencyPerChain: 3 };
let netWorthHistory = [];
let adminUsers = [];
let adminInvites = [];
let adminSettings = { registrationMode: 'disabled' };
let instanceAuth = { needsSetup: false, registrationMode: 'disabled', registrationEnabled: false };
let syncInFlight = false;
let currentUser = null;
let csrfToken = '';
const state = { activeView: 'overview', selectedPhone: phones[0]?.id || '', expandedPhoneId: '', managerFilter: 'all', addressPhone: 'all', chain: '全部', search: '', phoneSearch: '', hideSmall: false, privacy: localStorage.getItem(STORE.privacy) === 'true', allocationMode: 'chain', netWorthRange: '1d', netWorthDate: '', statsManager: 'all', statsPhone: 'all', statsSybil: 'all', statsSearch: '', showArchivedActivities: false, matrixDensity: localStorage.getItem('chainfolio_matrix_density_v1') || 'comfortable', expandedSections: {} };
const selectedStatsWallets = new Set();
const matrixHiddenColumns = new Set(loadJson('chainfolio_matrix_hidden_v1', []));
const fontScales = [0.9, 1, 1.15, 1.3];
const LIST_LIMIT = 20;

function applyFontScale(value, persist = true) {
  const requested = Number(value);
  const scale = fontScales.includes(requested) ? requested : 1;
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  document.querySelectorAll('[data-font-scale]').forEach(select => { select.value = String(scale); });
  if (persist) localStorage.setItem(STORE.fontScale, String(scale));
}

applyFontScale(localStorage.getItem(STORE.fontScale) || '1', false);

const numericValue = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const assetValue = asset => numericValue(asset?.value);
const money = value => `$${numericValue(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const privacyMask = '<span class="privacy-mask" aria-label="金额已隐藏">••••••</span>';
const privateValue = value => state.privacy ? privacyMask : `<span class="private-value">${value}</span>`;
const privateText = value => state.privacy ? '••••••' : String(value);
function applyPrivacyMode(enabled, persist = true) {
  state.privacy = Boolean(enabled);
  document.body.classList.toggle('private-hidden', state.privacy);
  const button = document.querySelector('#privacyButton');
  button.textContent = state.privacy ? '○' : '◉';
  button.setAttribute('aria-pressed', String(state.privacy));
  button.setAttribute('aria-label', state.privacy ? '显示资产金额' : '隐藏资产金额');
  button.title = state.privacy ? '显示资产金额' : '隐藏资产金额';
  if (persist) localStorage.setItem(STORE.privacy, String(state.privacy));
}
const assetAmount = asset => {
  const raw = String(asset?.amount ?? '').replace(/,/g, '').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatAmount = value => numericValue(value).toLocaleString('en-US', { maximumFractionDigits: 6 });
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const phoneName = phoneId => phones.find(phone => phone.id === phoneId)?.name || phoneId;
const managerById = managerId => managers.find(manager => manager.id === managerId);
const managerForPhone = phoneId => managerById(phones.find(phone => phone.id === phoneId)?.managerId);
const walletLabel = (wallet, phoneId = '') => walletNames[`${phoneId}:${wallet}`] || `OKX 钱包 ${wallet}`;
const walletInfo = (phoneId, wallet) => walletMetadata[`${phoneId}:${wallet}`] || { createdAt: '', sybilStatus: 'unreviewed', note: '' };
const walletActivities = (phoneId, wallet) => walletActivityStatuses[`${phoneId}:${wallet}`] || {};
const activeActivityTemplates = () => walletActivityTemplates.filter(template => !template.archived);
const statsActivityTemplates = () => walletActivityTemplates.filter(template => state.showArchivedActivities || !template.archived);
const templateFields = template => Array.isArray(template?.fields) ? template.fields : [];
const activityRecord = (activities, template) => {
  const raw = activities?.[template.id];
  return raw && typeof raw === 'object' ? raw : (typeof raw === 'string' ? { status: raw } : {});
};
const fieldValue = (activities, template, field) => activityRecord(activities, template)[field.id] ?? (field.type === 'checkbox' ? false : '');
const fieldOption = (field, value) => (field.options || []).find(option => option.id === value);
const fieldValueLabel = (field, value) => {
  if (field.type === 'checkbox') return value ? '已勾选' : '未勾选';
  if (field.type === 'select') return fieldOption(field, value)?.label || '未填写';
  return value === '' || value == null ? '未填写' : String(value);
};
const fieldTone = (field, value) => field.type === 'select' ? (fieldOption(field, value)?.role || 'none').replace('_', '-') : '';
const ledgerFields = templates => templates.flatMap(template => templateFields(template).filter(field => field.showInLedger !== false).map(field => ({ template, field })));
const statFields = templates => templates.flatMap(template => templateFields(template).filter(field => field.showInStats !== false).map(field => ({ template, field })));
const sybilStatuses = {
  unreviewed: { label: '未登记', className: 'unreviewed' },
  pending: { label: '待检查', className: 'pending' },
  normal: { label: '未发现风险', className: 'normal' },
  suspected: { label: '疑似女巫', className: 'suspected' },
  confirmed: { label: '已确认女巫', className: 'confirmed' }
};
const sybilInfo = status => sybilStatuses[status] || sybilStatuses.unreviewed;
const formatWalletCreatedAt = value => value ? String(value).replace('T', ' ').slice(0, 16) : '未填写';
const walletAssets = (phoneId, wallet) => assets.filter(asset => asset.phoneId === phoneId && asset.wallet === wallet);
const walletAddresses = (phoneId, wallet) => addresses.filter(item => item.phoneId === phoneId && item.wallet === wallet);
const walletCountFor = phoneId => Math.min(10, Math.max(1, Number(phoneWalletCounts[phoneId]) || 3));
const visibleItems = (items, section) => state.expandedSections[section] ? items : items.slice(0, LIST_LIMIT);

function renderListControl(id, total, section) {
  const control = document.querySelector(`#${id}`);
  if (!control || total <= LIST_LIMIT) { if (control) control.hidden = true; return; }
  const expanded = Boolean(state.expandedSections[section]);
  control.hidden = false;
  control.innerHTML = `<span>${expanded ? `已显示全部 ${total} 条` : `当前显示 ${LIST_LIMIT} 条，共 ${total} 条`}</span><button type="button" data-expand-section="${section}">${expanded ? '收起至 20 条' : `展开其余 ${total - LIST_LIMIT} 条`}</button>`;
}

async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(path, {
    ...options,
    headers
  });
  const payload = await response.json();
  if (response.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) showAuthScreen();
  if (!response.ok) throw new Error(payload.error || `请求失败：${response.status}`);
  return payload;
}

function applyBackendState(remote) {
  managers = remote.managers || managers;
  phones = remote.phones || phones;
  addresses = remote.addresses || addresses;
  customNetworks = remote.customNetworks || [];
  customTokens = remote.customTokens || [];
  phoneWalletCounts = remote.walletCounts || phoneWalletCounts;
  walletNames = remote.walletNames || {};
  walletMetadata = remote.walletMetadata || {};
  walletActivityTemplates = remote.walletActivityTemplates || [];
  walletActivityStatuses = remote.walletActivityStatuses || {};
  assets = remote.assets || assets;
  scheduler = remote.scheduler || scheduler;
  netWorthHistory = Array.isArray(remote.netWorthHistory) ? remote.netWorthHistory : [];
  lastSync = Number(remote.lastSync) || lastSync;
  if (remote.currentUser) currentUser = remote.currentUser;
  if (!phones.some(phone => phone.id === state.selectedPhone)) state.selectedPhone = phones[0]?.id || '';
  const badge = document.querySelector('#backendStatus');
  const rpcSynced = assets.some(asset => asset.source === 'rpc');
  badge.textContent = rpcSynced ? 'RPC SYNCED' : 'BACKEND ONLINE · DEMO SEED';
  badge.className = 'demo-badge online';
}

async function loadBackendState() {
  try { applyBackendState(await api('/api/state')); renderAll(); }
  catch (error) {
    const badge = document.querySelector('#backendStatus'); badge.textContent = 'BACKEND OFFLINE'; badge.className = 'demo-badge error'; showToast(error.message);
  }
}

function setAuthTab(tab) {
  if (tab === 'register' && !instanceAuth.registrationEnabled) tab = 'login';
  document.querySelectorAll('[data-auth-tab]').forEach(button => button.classList.toggle('active', button.dataset.authTab === tab));
  document.querySelector('#loginForm').hidden = tab !== 'login';
  document.querySelector('#registerForm').hidden = tab !== 'register';
  document.querySelector('#setupForm').hidden = true;
  document.querySelector('#authError').textContent = '';
}

function applySetupStatus(status = {}) {
  instanceAuth = {
    needsSetup: Boolean(status.needsSetup),
    registrationMode: status.registrationMode === 'invite' ? 'invite' : 'disabled',
    registrationEnabled: status.registrationMode === 'invite' || status.registrationEnabled === true
  };
  const setup = instanceAuth.needsSetup;
  const tabs = document.querySelector('#authTabs');
  const registerTab = document.querySelector('#registerTab');
  document.querySelector('#authTitle').textContent = setup ? '创建你的本地主账户' : '登录你的链上资产看板';
  document.querySelector('#authIntro').textContent = setup
    ? '这是全新的本机实例。主账户只属于这台设备，创建后即可开始导入公开钱包地址。'
    : '数据保存在这台设备；每位用户拥有独立的负责人、手机、钱包、链上地址与资产数据。';
  tabs.hidden = setup;
  tabs.classList.toggle('solo', !instanceAuth.registrationEnabled);
  registerTab.hidden = !instanceAuth.registrationEnabled;
  document.querySelector('#setupForm').hidden = !setup;
  document.querySelector('#loginForm').hidden = setup;
  document.querySelector('#registerForm').hidden = true;
  if (!setup) setAuthTab('login');
}

function showAuthScreen() {
  currentUser = null;
  csrfToken = '';
  document.querySelector('#appShell').hidden = true;
  document.querySelector('#authScreen').hidden = false;
  applySetupStatus(instanceAuth);
  document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(modal => { modal.hidden = true; });
  document.body.style.overflow = '';
}

function applySession(payload) {
  currentUser = payload.user;
  csrfToken = payload.csrfToken;
  const name = currentUser.username;
  document.querySelector('#profileName').textContent = name;
  document.querySelector('#profileInitials').textContent = [...name].slice(0, 2).join('').toUpperCase();
  document.querySelector('#profileRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'User';
  const isAdmin = currentUser.role === 'admin';
  document.querySelector('#adminNav').hidden = !isAdmin;
  document.querySelector('#authScreen').hidden = true;
  document.querySelector('#appShell').hidden = false;
  const hashView = location.hash.slice(1);
  setActiveView(viewTitles[hashView] ? hashView : state.activeView, false);
}

async function initializeAuth() {
  try {
    applySetupStatus(await api('/api/setup/status'));
    if (instanceAuth.needsSetup) { showAuthScreen(); return; }
    try {
      const session = await api('/api/auth/me');
      applySession(session);
      await loadBackendState();
      if (currentUser.role === 'admin') await loadAdminData();
    } catch { showAuthScreen(); }
  } catch (error) {
    showAuthScreen();
    document.querySelector('#authError').textContent = `无法读取本机实例：${error.message}`;
  }
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderAdminData(users, invites, settings = adminSettings) {
  adminUsers = users;
  adminInvites = invites;
  adminSettings = settings;
  const registrationEnabled = settings.registrationMode === 'invite';
  document.querySelector('#registrationModeSelect').value = registrationEnabled ? 'invite' : 'disabled';
  document.querySelector('#invitePanel').classList.toggle('registration-disabled', !registrationEnabled);
  document.querySelector('#inviteModeHint').textContent = registrationEnabled ? '每个邀请码只能使用一次。' : '团队注册当前关闭；单机主账户不需要邀请码。';
  document.querySelector('#userList').innerHTML = visibleItems(users, 'users').map(user => `<div class="admin-row"><div><strong>${escapeHtml(user.username)} ${user.role === 'admin' ? '· 管理员' : ''}</strong><small>注册 ${formatDate(user.createdAt)} · 最近登录 ${formatDate(user.lastLoginAt)}</small></div>${user.id === currentUser.id ? '<span class="status-pill">当前账户</span>' : `<button class="button secondary compact-button ${user.status === 'active' ? 'danger-action' : ''}" data-user-status="${user.id}" data-next-status="${user.status === 'active' ? 'disabled' : 'active'}">${user.status === 'active' ? '停用' : '启用'}</button>`}</div>`).join('') || '<div class="empty-state">暂无用户</div>';
  const orderedInvites = invites.slice().reverse();
  document.querySelector('#inviteList').innerHTML = visibleItems(orderedInvites, 'invites').map(invite => {
    const status = invite.usedAt ? `已使用 · ${formatDate(invite.usedAt)}` : invite.revokedAt ? '已撤销' : '等待注册';
    const action = !invite.usedAt && !invite.revokedAt ? `<button class="button secondary compact-button danger-action" data-revoke-invite="${invite.id}">撤销</button>` : `<span class="status-pill ${invite.revokedAt ? 'disabled' : ''}">${invite.usedAt ? '已使用' : '已撤销'}</span>`;
    return `<div class="admin-row"><div><strong>${escapeHtml(invite.label || '未备注的邀请码')}</strong><small>${status} · 创建于 ${formatDate(invite.createdAt)}</small></div>${action}</div>`;
  }).join('') || '<div class="empty-state">还没有生成邀请码</div>';
  renderListControl('userListControl', users.length, 'users');
  renderListControl('inviteListControl', orderedInvites.length, 'invites');
}

async function loadAdminData() {
  if (currentUser?.role !== 'admin') return;
  try {
    const [userData, inviteData, settingsData] = await Promise.all([api('/api/admin/users'), api('/api/admin/invites'), api('/api/admin/settings')]);
    renderAdminData(userData.users, inviteData.invites, settingsData.settings);
  } catch (error) { showToast(error.message); }
}

function renderAddressWalletOptions(phoneId, selectedWallet = 1) {
  const count = walletCountFor(phoneId);
  const select = document.querySelector('#addressWallet');
  select.innerHTML = Array.from({ length: count }, (_, index) => `<option value="${index + 1}">${escapeHtml(walletLabel(index + 1, phoneId))}</option>`).join('');
  select.value = String(Math.min(selectedWallet, count));
}

function renderSelectors() {
  const phoneOptions = phones.map(phone => `<option value="${phone.id}">${escapeHtml(phone.name)} · ${escapeHtml(managerForPhone(phone.id)?.name || '未分配')}</option>`).join('');
  document.querySelector('#addressPhone').innerHTML = phoneOptions;
  document.querySelector('#addressPhoneFilter').innerHTML = `<option value="all">全部手机</option>${phoneOptions}`;
  document.querySelector('#addressPhoneFilter').value = state.addressPhone;
  const managerOptions = managers.map(manager => `<option value="${manager.id}">${escapeHtml(manager.name)}</option>`).join('');
  document.querySelector('#managerFilter').innerHTML = `<option value="all">全部负责人</option>${managerOptions}`;
  document.querySelector('#managerFilter').value = state.managerFilter;
  document.querySelector('#phoneManager').innerHTML = managerOptions;
  renderAddressWalletOptions(document.querySelector('#addressPhone').value || state.selectedPhone);
}

function renderAllocation(quotedAssets) {
  const grouped = new Map();
  for (const asset of quotedAssets) {
    const name = state.allocationMode === 'token' ? asset.symbol : asset.chain;
    const group = grouped.get(name) || { name, value: 0, amount: 0, symbols: new Set() };
    group.value += Number(asset.value);
    group.amount += assetAmount(asset);
    group.symbols.add(asset.symbol);
    grouped.set(name, group);
  }
  const allocationTotal = [...grouped.values()].reduce((sum, group) => sum + group.value, 0);
  const ranked = [...grouped.values()].sort((left, right) => right.value - left.value);
  const groups = ranked;
  const palette = ['#b8ff62', '#9188ff', '#53d5e7', '#ffbd66', '#4a514d'];
  const groupColor = index => palette[index] || `hsl(${(index * 47 + 18) % 360} 58% 58%)`;
  const donut = document.querySelector('#allocationDonut');
  const legend = document.querySelector('#allocationLegend');
  document.querySelector('#allocationAssetCount').textContent = grouped.size;
  document.querySelector('#allocationUnitLabel').textContent = state.allocationMode === 'token' ? '种币' : '条链';
  document.querySelectorAll('[data-allocation-mode]').forEach(button => button.classList.toggle('active', button.dataset.allocationMode === state.allocationMode));
  if (allocationTotal > 0 && groups.length) {
    let cursor = 0;
    const stops = groups.map((group, index) => {
      const start = cursor; cursor += group.value / allocationTotal * 100;
      return `${groupColor(index)} ${start.toFixed(3)}% ${cursor.toFixed(3)}%`;
    });
    donut.style.background = `conic-gradient(${stops.join(', ')})`;
    legend.innerHTML = groups.map((group, index) => {
      const quantity = state.allocationMode === 'token' && !group.isOther
        ? `${formatAmount(group.amount)} ${escapeHtml(group.name)}`
        : `${group.symbols.size} 种币`;
      const quantityText = state.allocationMode === 'token' ? privateValue(quantity) : quantity;
      return `<div><i class="legend-dot" style="background:${groupColor(index)}"></i><span><b>${escapeHtml(group.name)}</b><small>${quantityText}</small></span><strong><b>${privateValue(money(group.value))}</b><small>${(group.value / allocationTotal * 100).toFixed(1)}%</small></strong></div>`;
    }).join('');
  } else {
    donut.style.background = '#262c28';
    legend.innerHTML = '<div class="allocation-empty">暂无已报价资产</div>';
  }
}

function estimatedYesterdayTotal(quotedAssets) {
  let previousTotal = 0;
  let coveredValue = 0;
  for (const asset of quotedAssets) {
    const change = Number(asset.change);
    if (!Number.isFinite(change) || change <= -99.99) continue;
    previousTotal += Number(asset.value) / (1 + change / 100);
    coveredValue += Number(asset.value);
  }
  return coveredValue > 0 ? previousTotal : null;
}

function selectedComparison(total, quotedAssets) {
  const now = Date.now();
  const definitions = { '1d': { milliseconds: 24 * 60 * 60 * 1000, label: '较昨日' }, '7d': { milliseconds: 7 * 24 * 60 * 60 * 1000, label: '较 7 天前' }, '30d': { milliseconds: 30 * 24 * 60 * 60 * 1000, label: '较 30 天前' }, '90d': { milliseconds: 90 * 24 * 60 * 60 * 1000, label: '较 90 天前' } };
  const history = netWorthHistory.map(point => ({ timestamp: Number(point.timestamp), total: Number(point.total) })).filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.total)).sort((left, right) => left.timestamp - right.timestamp);
  let point = null;
  let label;
  let target;
  let estimated = false;
  if (state.netWorthRange === 'custom') {
    const dateValue = state.netWorthDate;
    label = dateValue ? `较 ${dateValue}` : '自定义日期';
    if (dateValue) {
      const start = new Date(`${dateValue}T00:00:00`).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      point = history.filter(item => item.timestamp >= start && item.timestamp < end).at(-1) || null;
      target = start;
    }
  } else {
    const definition = definitions[state.netWorthRange] || definitions['1d'];
    label = definition.label;
    target = now - definition.milliseconds;
    point = history.reduce((best, item) => !best || Math.abs(item.timestamp - target) < Math.abs(best.timestamp - target) ? item : best, null);
    if (point && Math.abs(point.timestamp - target) > 12 * 60 * 60 * 1000) point = null;
    if (!point && state.netWorthRange === '1d') {
      const estimatedTotal = estimatedYesterdayTotal(quotedAssets);
      if (estimatedTotal != null) { point = { timestamp: target, total: estimatedTotal }; estimated = true; label = '较昨日（行情估算）'; }
    }
  }
  if (!point || point.total <= 0) return { label, target, point: null };
  const delta = total - point.total;
  return { label, target, point, delta, percent: delta / point.total * 100, estimated };
}

function renderNetWorthTrend(total, comparison) {
  const now = Date.now();
  const start = comparison.target || now - 24 * 60 * 60 * 1000;
  let points = netWorthHistory.map(point => ({ timestamp: Number(point.timestamp), total: Number(point.total) })).filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point.total) && point.timestamp >= start && point.timestamp <= now).sort((left, right) => left.timestamp - right.timestamp);
  points.push({ timestamp: now, total });
  if (points.length > 10) points = Array.from({ length: 10 }, (_, index) => points[Math.round(index * (points.length - 1) / 9)]);
  const values = points.map(point => point.total);
  const minimum = Math.min(...values); const maximum = Math.max(...values); const spread = maximum - minimum;
  document.querySelector('#netWorthSpark').innerHTML = points.map(point => `<i title="${escapeHtml(formatDate(point.timestamp))}${state.privacy ? '' : ` · ${money(point.total)}`}" style="height:${spread ? 22 + (point.total - minimum) / spread * 78 : 55}%"></i>`).join('');
}

function renderOverview() {
  const total = assets.reduce((sum, asset) => sum + assetValue(asset), 0);
  document.querySelector('#totalBalance').textContent = privateText(total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const quotedAssets = assets.filter(asset => Number.isFinite(Number(asset.value)) && Number(asset.value) > 0);
  renderAllocation(quotedAssets);
  const comparison = selectedComparison(total, quotedAssets);
  const percentNode = document.querySelector('#portfolioChangePercent');
  const valueNode = document.querySelector('#portfolioChangeValue');
  if (!comparison.point) {
    percentNode.textContent = '—'; percentNode.className = ''; valueNode.textContent = `${comparison.label} · 暂无历史快照`;
  } else {
    const positive = comparison.delta >= 0;
    percentNode.textContent = `${positive ? '↗ +' : '↘ '}${comparison.percent.toFixed(2)}%`;
    percentNode.className = positive ? 'positive' : 'change-down';
    valueNode.innerHTML = `${privateValue(`${positive ? '+' : '-'}${money(Math.abs(comparison.delta))}`)} · ${escapeHtml(comparison.label)}`;
  }
  renderNetWorthTrend(total, comparison);
  const totalWallets = phones.reduce((sum, phone) => sum + walletCountFor(phone.id), 0);
  document.querySelector('#heroManagerCount').textContent = `${managers.length} 负责人`;
  document.querySelector('#heroPhoneCount').textContent = `${phones.length} 手机`;
  document.querySelector('#heroWalletCount').textContent = `${totalWallets} 钱包`;
  document.querySelector('#metricManagers').textContent = String(managers.length).padStart(2, '0');
  document.querySelector('#metricPhones').textContent = String(phones.length).padStart(2, '0');
  document.querySelector('#metricWallets').textContent = totalWallets;
  document.querySelector('#heroAddressCount').textContent = `${addresses.length} 地址`;
  document.querySelector('#metricAddresses').textContent = String(addresses.length).padStart(2, '0');
  const syncedChains = new Set(assets.map(asset => asset.chain));
  document.querySelector('#metricChains').textContent = `${syncedChains.size || new Set(addresses.map(item => item.chain)).size} 条链`;
}

function renderManagers() {
  document.querySelector('#managerGrid').innerHTML = visibleItems(managers, 'managers').map(manager => {
    const managedPhones = phones.filter(phone => phone.managerId === manager.id);
    const phoneIds = new Set(managedPhones.map(phone => phone.id));
    const managedAssets = assets.filter(asset => phoneIds.has(asset.phoneId));
    const managedAddresses = addresses.filter(item => phoneIds.has(item.phoneId));
    const total = managedAssets.reduce((sum, asset) => sum + assetValue(asset), 0);
    const walletCount = managedPhones.reduce((sum, phone) => sum + walletCountFor(phone.id), 0);
    return `<article class="manager-card"><div class="manager-card-top"><span class="manager-avatar" style="background:${manager.color}">${escapeHtml(manager.name.slice(0, 1))}</span><span class="record-actions"><button data-edit-manager="${manager.id}">编辑</button><button class="danger-action" data-delete-manager="${manager.id}">删除</button></span></div>
      <h3>${escapeHtml(manager.name)}管理账户</h3><strong class="manager-value">${privateValue(money(total))}</strong>
      <div class="manager-stats"><span><b>${managedPhones.length}</b> 手机</span><span><b>${walletCount}</b> 钱包</span><span><b>${managedAddresses.length}</b> 地址</span></div></article>`;
  }).join('');
  renderListControl('managerListControl', managers.length, 'managers');
}

function renderWalletActivityChips(phoneId, wallet) {
  const templates = activeActivityTemplates();
  if (!templates.length) return '<span class="activity-empty">暂无活动</span>';
  const activities = walletActivities(phoneId, wallet);
  const visible = ledgerFields(templates).filter(({ template, field }) => {
    const value = fieldValue(activities, template, field);
    return value !== '' && value !== false;
  });
  if (!visible.length) return '<span class="activity-empty">管理字段未填写</span>';
  const chips = visible.slice(0, 3).map(({ template, field }) => {
    const value = fieldValue(activities, template, field);
    const label = `${template.name} · ${field.name}: ${fieldValueLabel(field, value)}`;
    return `<span class="activity-chip ${fieldTone(field, value)}" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }).join('');
  return `${chips}${visible.length > 3 ? `<span class="activity-more">+${visible.length - 3}</span>` : ''}`;
}

function renderPhoneWalletDetails(phone) {
  const walletCount = walletCountFor(phone.id);
  const rows = Array.from({ length: walletCount }, (_, index) => index + 1).map(wallet => {
    const metadata = walletInfo(phone.id, wallet);
    const sybil = sybilInfo(metadata.sybilStatus);
    const scopedAddresses = walletAddresses(phone.id, wallet);
    const value = walletAssets(phone.id, wallet).reduce((sum, asset) => sum + assetValue(asset), 0);
    return `<article class="phone-wallet-item">
      <div class="phone-wallet-identity"><span>W${wallet}</span><div><strong>${escapeHtml(walletLabel(wallet, phone.id))}</strong><small>${escapeHtml(metadata.note || '暂无备注')}</small></div></div>
      <div class="phone-wallet-meta"><small>生成时间</small><strong>${escapeHtml(formatWalletCreatedAt(metadata.createdAt))}</strong></div>
      <div class="phone-wallet-meta"><small>女巫状态</small><span class="sybil-badge ${sybil.className}">${sybil.label}</span></div>
      <div class="phone-wallet-meta"><small>活动 / 任务</small><div class="wallet-activity-chips">${renderWalletActivityChips(phone.id, wallet)}</div></div>
      <div class="phone-wallet-meta"><small>地址 / 净值</small><strong>${scopedAddresses.length} 个 · ${privateValue(money(value))}</strong></div>
      <span class="row-actions"><button class="copy-button" data-phone-wallet-address="${wallet}" data-phone-id="${phone.id}">添加链上地址</button><button class="copy-button" data-phone-wallet-edit="${wallet}" data-phone-id="${phone.id}">编辑资料</button>${walletCount > 1 ? `<button class="copy-button danger-action" data-phone-wallet-delete="${wallet}" data-phone-id="${phone.id}">删除</button>` : ''}</span>
    </article>`;
  }).join('');
  const addWallet = walletCount < 10 ? `<button class="copy-button" data-phone-add-wallet="${phone.id}">＋ 添加钱包（${walletCount}/10）</button>` : '<small>已达到每台手机 10 个钱包上限</small>';
  return `<tr class="phone-wallet-expansion"><td colspan="6"><div class="phone-wallet-panel"><div class="phone-wallet-panel-head"><div><strong>${escapeHtml(phone.name)}的钱包资料</strong><small>活动模板全账户通用，每个钱包独立记录进度</small></div>${addWallet}</div><div class="phone-wallet-list">${rows}</div></div></td></tr>`;
}

function renderPhones() {
  const term = state.phoneSearch.trim().toLowerCase();
  const filtered = phones.filter(phone => (state.managerFilter === 'all' || phone.managerId === state.managerFilter) && `${phone.id} ${phone.name} ${managerForPhone(phone.id)?.name || ''}`.toLowerCase().includes(term));
  document.querySelector('#phoneSectionTitle').textContent = `${filtered.length} 台手机`;
  document.querySelector('#phoneTableBody').innerHTML = visibleItems(filtered, 'phones').map(phone => {
    const scopedAddresses = addresses.filter(item => item.phoneId === phone.id);
    const scopedAssets = assets.filter(asset => asset.phoneId === phone.id);
    const value = scopedAssets.reduce((sum, asset) => sum + assetValue(asset), 0);
    const activeWallets = new Set(scopedAddresses.map(item => item.wallet)).size;
    const configuredWallets = walletCountFor(phone.id);
    const walletNumbers = Array.from({ length: configuredWallets }, (_, index) => index + 1);
    const suspectedCount = walletNumbers.filter(wallet => walletInfo(phone.id, wallet).sybilStatus === 'suspected').length;
    const confirmedCount = walletNumbers.filter(wallet => walletInfo(phone.id, wallet).sybilStatus === 'confirmed').length;
    const isExpanded = state.expandedPhoneId === phone.id;
    return `<tr class="${phone.id === state.selectedPhone || isExpanded ? 'selected-row' : ''}">
      <td><div class="phone-name"><span>${phone.id.slice(-2)}</span><div><strong>${phone.name}</strong><small>${phone.id}</small></div></div></td>
      <td><select class="manager-assign" data-phone-manager="${phone.id}" aria-label="设置${escapeHtml(phone.name)}的负责人">${managers.map(manager => `<option value="${manager.id}" ${manager.id === phone.managerId ? 'selected' : ''}>${escapeHtml(manager.name)}</option>`).join('')}</select></td>
      <td><span class="wallet-progress"><i style="width:${configuredWallets / 10 * 100}%"></i></span><small>${configuredWallets}/10 个 · ${activeWallets} 个有地址${suspectedCount ? ` · 疑似 ${suspectedCount}` : ''}${confirmedCount ? ` · 已确认 ${confirmedCount}` : ''}</small></td>
      <td>${scopedAddresses.length}</td><td><strong>${privateValue(money(value))}</strong></td>
      <td><span class="row-actions"><button class="copy-button" data-view-phone="${phone.id}">${isExpanded ? '收起钱包' : '查看钱包'}</button><button class="copy-button" data-edit-phone="${phone.id}">编辑</button><button class="copy-button danger-action" data-delete-phone="${phone.id}">删除</button></span></td></tr>${isExpanded ? renderPhoneWalletDetails(phone) : ''}`;
  }).join('');
  renderListControl('phoneListControl', filtered.length, 'phones');
}

function renderAddresses() {
  const scoped = addresses.filter(item => state.addressPhone === 'all' || item.phoneId === state.addressPhone);
  document.querySelector('#addressList').innerHTML = scoped.length ? visibleItems(scoped, 'addresses').map(item => {
    const isEvm = item.chain === 'EVM';
    const networkName = isEvm ? 'EVM 多链' : item.chain;
    const statusText = item.status === 'synced'
      ? (isEvm ? `已同步 ${item.syncedChains || item.totalChains || 0} 条链` : '已同步')
      : item.status === 'partial' ? `已同步 ${item.syncedChains || 0}/${item.totalChains || 0} 条链`
        : item.status === 'error' ? '同步失败' : '待更新';
    const discoveryModes = Array.isArray(item.tokenDiscovery?.modes) ? item.tokenDiscovery.modes : [];
    const discoveryStatus = Object.keys(item.tokenDiscovery?.errors || {}).length ? ' · 代币自动发现需检查 RPC' : item.tokenDiscovery?.truncated ? ' · 代币历史扫描未完成' : discoveryModes.includes('etherscan') ? ' · Etherscan 索引' : discoveryModes.includes('blockscout') ? ' · Blockscout 索引' : discoveryModes.includes('transfer-log') ? ' · Transfer 扫描' : '';
    const nextTime = Number.isFinite(Date.parse(item.nextSyncAt))
      ? new Date(item.nextSyncAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '等待安排';
    return `
    <div class="address-row device-address-row">
      <div class="address-account"><span>${item.phoneId.slice(-2)}</span><div><strong>${phoneName(item.phoneId)}</strong><small>${escapeHtml(managerForPhone(item.phoneId)?.name || '未分配')} · ${escapeHtml(walletLabel(item.wallet, item.phoneId))}</small></div></div>
      <div class="address-network"><span class="chain-chip">${isEvm ? 'EV' : escapeHtml(item.chain.slice(0, 2))}</span><div><strong>${escapeHtml(networkName)}</strong><small>${statusText}${discoveryStatus} · 下次约 ${nextTime}</small></div></div>
      <span class="address-hash">${escapeHtml(item.address)}</span><span class="row-actions"><button class="copy-button" data-copy="${escapeHtml(item.address)}">复制</button><button class="copy-button" data-edit-address="${item.id}">编辑</button><button class="copy-button danger-action" data-delete-address="${item.id}">删除</button></span>
    </div>`;
  }).join('') : '<div class="empty-state">这台手机还没有导入地址</div>';
  renderListControl('addressListControl', scoped.length, 'addresses');
}

function renderChainFilters() {
  const chains = ['全部', ...new Set(assets.map(asset => asset.chain))];
  document.querySelector('#chainFilter').innerHTML = chains.map(chain => `<button class="${state.chain === chain ? 'active' : ''}" data-chain="${chain}">${chain}</button>`).join('');
}

function filteredAssets() {
  const term = state.search.toLowerCase();
  return assets.filter(asset => (state.chain === '全部' || asset.chain === state.chain) && `${asset.symbol} ${asset.name} ${asset.chain} ${asset.phoneId}`.toLowerCase().includes(term) && (!state.hideSmall || assetValue(asset) >= 10));
}

function renderAssets() {
  const filtered = filteredAssets();
  document.querySelector('#exportAssetsButton').textContent = `⇩ 导出当前 ${filtered.length} 条`;
  document.querySelector('#assetTableBody').innerHTML = visibleItems(filtered, 'assets').map(asset => {
    const tokenRecord = asset.customTokenId ? customTokens.find(token => token.id === asset.customTokenId) : null;
    const tokenActions = !asset.customTokenId ? '<span class="muted-dash">—</span>' : tokenRecord?.system ? '<span class="muted-dash">系统管理</span>' : `<span class="row-actions"><button class="copy-button" data-edit-token="${asset.customTokenId}">编辑</button><button class="copy-button danger-action" data-delete-token="${asset.customTokenId}">删除</button></span>`;
    const change = Number(asset.change);
    const hasChange = Number.isFinite(change);
    const changeText = hasChange ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—';
    const priceLabel = asset.priceSource === 'manual' ? ' · 手动价格' : asset.priceSource === 'stablecoin-fallback' ? ' · 稳定币估值' : asset.priceSource === 'wrapped-native-fallback' ? ' · ETH 参考价' : asset.priceSource === 'dexscreener' ? ' · 自动报价' : ['etherscan', 'blockscout'].includes(asset.priceSource) ? ` · ${asset.priceSource === 'etherscan' ? 'Etherscan 报价' : 'Blockscout 报价'}` : '';
    const discoveryLabel = asset.source === 'auto-discovery' ? ` · 自动发现${asset.stale ? ' · 上次已知' : ''}` : '';
    const valueText = Number.isFinite(Number(asset.value)) ? `<strong>${privateValue(money(asset.value))}</strong>` : '<span class="no-quote">暂无报价</span>';
    return `
    <tr><td><div class="asset-name"><span class="token-icon" style="background:${escapeHtml(asset.color || '#53d5e7')}">${escapeHtml(asset.symbol.slice(0, 2))}</span><div><strong>${escapeHtml(asset.symbol)}</strong><small>${escapeHtml(asset.name)}</small></div></div></td>
    <td><span class="network-badge"><i></i>${escapeHtml(asset.chain)}</span></td><td><span class="asset-source">${escapeHtml(managerForPhone(asset.phoneId)?.name || '未分配')} / ${escapeHtml(phoneName(asset.phoneId))} · ${escapeHtml(walletLabel(asset.wallet, asset.phoneId))}${asset.customTokenId ? ' · 自定义币种' : ''}${discoveryLabel}${priceLabel}</span></td><td>${privateValue(escapeHtml(asset.amount))}</td><td class="${hasChange ? change >= 0 ? 'change-up' : 'change-down' : ''}">${changeText}</td><td>${valueText}</td><td>${tokenActions}</td></tr>`;
  }).join('');
  document.querySelector('#emptyState').hidden = filtered.length > 0;
  renderListControl('assetListControl', filtered.length, 'assets');
}

function renderNetworks() {
  const all = [...builtInNetworks, ...customNetworks];
  document.querySelector('#networkGrid').innerHTML = visibleItems(all, 'networks').map(network => `<article class="network-card"><span class="network-logo" style="background:${network.color || '#ffbd66'}">${escapeHtml(network.symbol.slice(0, 2))}</span><div><strong>${escapeHtml(network.name)}</strong><small>${escapeHtml(network.symbol)}${network.chainId ? ` · ID ${escapeHtml(network.chainId)}` : ''}</small></div><span class="network-type">${builtInNetworks.some(item => item.name === network.name) ? '默认' : '自定义'} · ${network.type}</span></article>`).join('');
  renderListControl('networkListControl', all.length, 'networks');
  const evmCount = all.filter(network => network.type === 'EVM').length;
  document.querySelector('#addressChain').innerHTML = `<option value="EVM">EVM 地址（自动同步 ${evmCount} 条 EVM 链）</option><option value="Solana">Solana 地址</option>`;
}

function allWalletRows() {
  return phones.flatMap(phone => Array.from({ length: walletCountFor(phone.id) }, (_, index) => {
    const wallet = index + 1; const manager = managerForPhone(phone.id); const metadata = walletInfo(phone.id, wallet);
    return { key: `${phone.id}:${wallet}`, phone, manager, wallet, metadata, activities: walletActivities(phone.id, wallet), addressCount: walletAddresses(phone.id, wallet).length, value: walletAssets(phone.id, wallet).reduce((sum, asset) => sum + assetValue(asset), 0) };
  }));
}

function filteredWalletStatRows() {
  const term = state.statsSearch.trim().toLowerCase();
  return allWalletRows().filter(row => (state.statsManager === 'all' || row.phone.managerId === state.statsManager)
    && (state.statsPhone === 'all' || row.phone.id === state.statsPhone)
    && (state.statsSybil === 'all' || (state.statsSybil === 'registered' ? row.metadata.sybilStatus !== 'unreviewed' : row.metadata.sybilStatus === state.statsSybil))
    && (!term || `${row.manager?.name || ''} ${row.phone.name} ${row.phone.id} ${walletLabel(row.wallet, row.phone.id)}`.toLowerCase().includes(term)));
}

function renderBulkStatusValues() {
  const field = document.querySelector('#bulkStatusField').value;
  if (field === 'sybilStatus') {
    document.querySelector('#bulkStatusValue').innerHTML = Object.entries(sybilStatuses).map(([value, status]) => `<option value="${value}">${status.label}</option>`).join('');
    return;
  }
  const [, templateId, fieldId] = field.split(':');
  const activityField = walletActivityTemplates.find(template => template.id === templateId)?.fields?.find(item => item.id === fieldId);
  if (!activityField) { document.querySelector('#bulkStatusValue').innerHTML = ''; return; }
  document.querySelector('#bulkStatusValue').innerHTML = activityField.type === 'checkbox'
    ? '<option value="true">已勾选</option><option value="false">未勾选</option>'
    : `<option value="">未填写</option>${(activityField.options || []).map(option => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('')}`;
}

function renderWalletStats() {
  const rows = allWalletRows();
  const total = rows.length; const count = status => rows.filter(row => row.metadata.sybilStatus === status).length;
  const registered = total - count('unreviewed'); const registeredRate = total ? registered / total * 100 : 0;
  const cards = [
    ['钱包总数', total, '统计口径：钱包', 'all'], ['已登记', registered, `${registeredRate.toFixed(1)}% 登记率`, 'registered'], ['待检查', count('pending'), '已登记，等待检查', 'pending'], ['未发现风险', count('normal'), '检查结果正常', 'normal'], ['疑似女巫', count('suspected'), '需要进一步复核', 'suspected'], ['已确认女巫', count('confirmed'), '已确认存在风险', 'confirmed']
  ];
  document.querySelector('#walletStatCards').innerHTML = cards.map(([label, value, note, filter], index) => `<button type="button" class="wallet-stat-card tone-${index} ${state.statsSybil === filter ? 'active' : ''}" data-stat-card-filter="${filter}"><small>${label}</small><strong>${value}</strong><span>${note}</span></button>`).join('');
  document.querySelector('#overviewRiskSummary').innerHTML = `<span><b>${count('pending')}</b>待检查</span><span><b>${count('suspected')}</b>疑似</span><span><b>${count('confirmed')}</b>已确认</span>`;

  document.querySelector('#managerStatsBody').innerHTML = managers.length ? managers.map(manager => {
    const scoped = rows.filter(row => row.phone.managerId === manager.id); const scopedCount = status => scoped.filter(row => row.metadata.sybilStatus === status).length;
    return `<tr><td><button class="stats-link" data-stats-manager-link="${manager.id}">${escapeHtml(manager.name)}</button></td><td>${scoped.length}</td><td>${scopedCount('normal')}</td><td>${scopedCount('suspected')}</td><td>${scopedCount('confirmed')}</td><td>${scopedCount('unreviewed') + scopedCount('pending')}</td></tr>`;
  }).join('') : '<tr><td colspan="6" class="stats-empty">暂无负责人数据</td></tr>';

  const templates = statsActivityTemplates(); const statistics = statFields(templates);
  document.querySelector('#activityStatsBody').innerHTML = statistics.length ? statistics.map(({ template, field }) => {
    const counts = { completed: 0, in_progress: 0, risk: 0, filled: 0 };
    rows.forEach(row => {
      const value = fieldValue(row.activities, template, field);
      const filled = value !== '' && value !== false;
      if (filled) counts.filled += 1;
      const role = field.type === 'select' ? fieldOption(field, value)?.role : 'none';
      if (role && role !== 'none') counts[role] += 1;
    });
    const rate = total ? counts.completed / total * 100 : 0;
    return `<tr class="${template.archived ? 'archived-row' : ''}"><td><span class="activity-stat-name">${escapeHtml(template.name)}<small>${escapeHtml(field.name)}${template.archived ? ' · 已归档' : ''}</small></span></td><td>${counts.completed}</td><td>${counts.in_progress}</td><td>${counts.risk}</td><td>${counts.filled}</td><td><span class="completion-rate"><i style="width:${rate}%"></i></span><b>${rate.toFixed(1)}%</b></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="stats-empty">暂无可统计字段。请在“字段与活动设置”中为字段开启统计。</td></tr>';
  const activeTemplates = activeActivityTemplates(); const activeStats = statFields(activeTemplates); const completedTotal = rows.reduce((sum, row) => sum + activeStats.filter(({ template, field }) => fieldOption(field, fieldValue(row.activities, template, field))?.role === 'completed').length, 0); const trackedTotal = total * activeStats.length;
  document.querySelector('#overviewActivitySummary').innerHTML = `<span><b>${activeTemplates.length}</b>管理模板</span><span><b>${completedTotal}</b>完成记录</span><span><b>${trackedTotal ? (completedTotal / trackedTotal * 100).toFixed(0) : 0}%</b>总体完成率</span>`;

  const managerOptions = managers.map(manager => `<option value="${manager.id}">${escapeHtml(manager.name)}</option>`).join('');
  document.querySelector('#statsManagerFilter').innerHTML = `<option value="all">全部负责人</option>${managerOptions}`; document.querySelector('#statsManagerFilter').value = state.statsManager;
  const availablePhones = phones.filter(phone => state.statsManager === 'all' || phone.managerId === state.statsManager);
  if (state.statsPhone !== 'all' && !availablePhones.some(phone => phone.id === state.statsPhone)) state.statsPhone = 'all';
  document.querySelector('#statsPhoneFilter').innerHTML = `<option value="all">全部手机</option>${availablePhones.map(phone => `<option value="${phone.id}">${escapeHtml(phone.name)}</option>`).join('')}`; document.querySelector('#statsPhoneFilter').value = state.statsPhone;
  document.querySelector('#statsSybilFilter').value = state.statsSybil; document.querySelector('#statsWalletSearch').value = state.statsSearch; document.querySelector('#showArchivedActivities').checked = state.showArchivedActivities;
  const currentBulkField = document.querySelector('#bulkStatusField').value || 'sybilStatus';
  const bulkFields = ledgerFields(activeActivityTemplates()).filter(({ field }) => ['select', 'checkbox'].includes(field.type));
  document.querySelector('#bulkStatusField').innerHTML = `<option value="sybilStatus">女巫检查</option>${bulkFields.map(({ template, field }) => `<option value="activity:${template.id}:${field.id}">${escapeHtml(`${template.name} · ${field.name}`)}</option>`).join('')}`;
  if ([...document.querySelector('#bulkStatusField').options].some(option => option.value === currentBulkField)) document.querySelector('#bulkStatusField').value = currentBulkField;
  renderBulkStatusValues();

  const filtered = filteredWalletStatRows(); const pageRows = visibleItems(filtered, 'statsMatrix'); const matrixFields = ledgerFields(statsActivityTemplates());
  const visibleMatrixFields = matrixFields.filter(({ template, field }) => !matrixHiddenColumns.has(`activity:${template.id}:${field.id}`));
  const showCreatedAt = !matrixHiddenColumns.has('createdAt'); const showAddressCount = !matrixHiddenColumns.has('addressCount'); const showValue = !matrixHiddenColumns.has('value');
  document.querySelector('#matrixColumnPicker').innerHTML = [{ id: 'createdAt', label: '生成时间' }, { id: 'addressCount', label: '地址数量' }, { id: 'value', label: '资产净值' }, ...matrixFields.map(({ template, field }) => ({ id: `activity:${template.id}:${field.id}`, label: `${template.name} · ${field.name}` }))].map(column => `<label><input type="checkbox" data-matrix-column="${column.id}" ${matrixHiddenColumns.has(column.id) ? '' : 'checked'} />${escapeHtml(column.label)}</label>`).join('');
  document.querySelectorAll('[data-density]').forEach(button => button.classList.toggle('active', button.dataset.density === state.matrixDensity));
  document.querySelector('.wallet-matrix-wrap').classList.toggle('compact', state.matrixDensity === 'compact');
  const validKeys = new Set(rows.map(row => row.key)); for (const key of selectedStatsWallets) if (!validKeys.has(key)) selectedStatsWallets.delete(key);
  document.querySelector('#walletMatrixHead').innerHTML = `<tr><th class="matrix-check"></th><th class="sticky-col manager-col">负责人</th><th class="sticky-col phone-col">手机</th><th class="sticky-col wallet-col">钱包</th>${showCreatedAt ? '<th>生成时间</th>' : ''}<th>女巫检查</th>${visibleMatrixFields.map(({ template, field }) => `<th class="activity-column ${template.archived ? 'archived-column' : ''}">${escapeHtml(template.name)}<small>${escapeHtml(field.name)}${template.archived ? ' · 已归档' : ''}</small></th>`).join('')}${showAddressCount ? '<th>地址</th>' : ''}${showValue ? '<th>资产净值</th>' : ''}</tr>`;
  document.querySelector('#walletMatrixBody').innerHTML = pageRows.length ? pageRows.map(row => {
    const sybil = row.metadata.sybilStatus || 'unreviewed';
    const controls = visibleMatrixFields.map(({ template, field }) => {
      const value = fieldValue(row.activities, template, field); const key = `activity:${template.id}:${field.id}`; const disabled = template.archived ? 'disabled' : '';
      if (field.type === 'select') return `<td><select class="matrix-select ${fieldTone(field, value)}" data-matrix-field="${key}" data-wallet-key="${row.key}" ${disabled}><option value="">未填写</option>${(field.options || []).map(option => `<option value="${escapeHtml(option.id)}" ${value === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></td>`;
      if (field.type === 'checkbox') return `<td class="matrix-boolean"><label><input type="checkbox" data-matrix-field="${key}" data-wallet-key="${row.key}" ${value ? 'checked' : ''} ${disabled} />已勾选</label></td>`;
      return `<td><input class="matrix-input" type="${field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}" value="${escapeHtml(value)}" data-matrix-field="${key}" data-wallet-key="${row.key}" ${field.type === 'number' ? 'step="any"' : ''} ${disabled} /></td>`;
    }).join('');
    return `<tr><td class="matrix-check"><input type="checkbox" data-stats-wallet-select="${row.key}" ${selectedStatsWallets.has(row.key) ? 'checked' : ''} /></td><td class="sticky-col manager-col">${escapeHtml(row.manager?.name || '未分配')}</td><td class="sticky-col phone-col"><strong>${escapeHtml(row.phone.name)}</strong><small>${row.phone.id}</small></td><td class="sticky-col wallet-col"><button class="stats-link" data-stats-edit-wallet="${row.key}">${escapeHtml(walletLabel(row.wallet, row.phone.id))}</button></td>${showCreatedAt ? `<td>${escapeHtml(formatWalletCreatedAt(row.metadata.createdAt))}</td>` : ''}<td><select class="matrix-select ${sybilInfo(sybil).className}" data-matrix-field="sybilStatus" data-wallet-key="${row.key}">${Object.entries(sybilStatuses).map(([value, status]) => `<option value="${value}" ${sybil === value ? 'selected' : ''}>${status.label}</option>`).join('')}</select></td>${controls}${showAddressCount ? `<td>${row.addressCount}</td>` : ''}${showValue ? `<td><strong>${privateValue(money(row.value))}</strong></td>` : ''}</tr>`;
  }).join('') : `<tr><td colspan="${5 + visibleMatrixFields.length + Number(showCreatedAt) + Number(showAddressCount) + Number(showValue)}" class="stats-empty">没有符合筛选条件的钱包</td></tr>`;
  document.querySelector('#selectedWalletCount').textContent = `已选择 ${selectedStatsWallets.size} 个钱包`;
  document.querySelector('#selectAllStatsWallets').checked = Boolean(pageRows.length) && pageRows.every(row => selectedStatsWallets.has(row.key));
  renderListControl('statsMatrixListControl', filtered.length, 'statsMatrix');
}

function exportWalletStats() {
  if (state.privacy && !confirm('当前处于隐藏余额模式。导出的 CSV 会包含真实资产净值，是否继续导出？')) return;
  const fields = ledgerFields(statsActivityTemplates()); const rows = filteredWalletStatRows();
  const headers = ['负责人', '手机', '手机编号', '钱包', '生成时间', '女巫检查', '备注', ...fields.map(({ template, field }) => `${template.name} · ${field.name}`), '地址数量', '资产净值(USD)'];
  const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [headers, ...rows.map(row => [row.manager?.name || '未分配', row.phone.name, row.phone.id, walletLabel(row.wallet, row.phone.id), formatWalletCreatedAt(row.metadata.createdAt), sybilInfo(row.metadata.sybilStatus).label, row.metadata.note || '', ...fields.map(({ template, field }) => fieldValueLabel(field, fieldValue(row.activities, template, field))), row.addressCount, row.value.toFixed(2)])].map(line => line.map(csvCell).join(','));
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `Chainfolio-钱包统计-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); showToast(`已导出 ${rows.length} 个钱包`);
}

function exportAssets() {
  const rows = filteredAssets();
  if (!rows.length) { showToast('当前筛选条件下没有可导出的资产'); return; }
  if (state.privacy && !confirm('当前处于隐藏余额模式。导出的 CSV 会包含真实持有量和资产价值，是否继续导出？')) return;
  const headers = ['负责人', '手机', '手机编号', '钱包', '链', '币种', '名称', '持有量', '24H(%)', '价值(USD)', '报价状态', '来源', '链上地址'];
  const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const addressForAsset = asset => {
    if (asset.addressId) return addresses.find(item => item.id === asset.addressId)?.address || '';
    const matching = addresses.find(item => item.phoneId === asset.phoneId && item.wallet === asset.wallet && (item.chain === asset.chain || item.chain === 'EVM'));
    return matching?.address || '';
  };
  const lines = [headers, ...rows.map(asset => {
    const priceState = Number.isFinite(Number(asset.value)) ? (asset.priceSource === 'manual' ? '手动价格' : asset.priceSource === 'stablecoin-fallback' ? '稳定币估值' : asset.priceSource === 'wrapped-native-fallback' ? 'ETH 参考价' : asset.priceSource === 'dexscreener' ? '自动报价' : ['etherscan', 'blockscout'].includes(asset.priceSource) ? '索引服务报价' : '已报价') : '暂无报价';
    return [managerForPhone(asset.phoneId)?.name || '未分配', phoneName(asset.phoneId), asset.phoneId, walletLabel(asset.wallet, asset.phoneId), asset.chain, asset.symbol, asset.name, asset.amount, Number.isFinite(Number(asset.change)) ? Number(asset.change).toFixed(2) : '', Number.isFinite(Number(asset.value)) ? Number(asset.value).toFixed(2) : '', priceState, `${asset.customTokenId ? '自定义币种' : (asset.source || '链上同步')}${asset.stale ? '（上次已知）' : ''}`, addressForAsset(asset)];
  })].map(line => line.map(csvCell).join(','));
  const blob = new Blob([`\ufeff${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `Chainfolio-资产明细-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); showToast(`已导出 ${rows.length} 条资产明细`);
}

function renderAll() { renderSelectors(); renderOverview(); renderWalletStats(); renderManagers(); renderPhones(); renderAddresses(); renderChainFilters(); renderAssets(); renderNetworks(); }

const viewTitles = { overview: '资产总览', 'wallet-stats': '钱包管理系统', managers: '负责人', phones: '手机', addresses: '链上地址', assets: '资产明细', networks: '链配置', users: '用户管理', guide: '使用指南' };
function closeMobileMenu() { document.body.classList.remove('mobile-nav-open'); document.querySelector('#mobileMenuButton').setAttribute('aria-expanded', 'false'); document.querySelector('#mobileNavOverlay').hidden = true; }
function setActiveView(view, updateHash = true) {
  const requested = viewTitles[view] ? view : 'overview'; const allowed = requested !== 'users' || currentUser?.role === 'admin'; state.activeView = allowed ? requested : 'overview';
  document.querySelectorAll('[data-view]').forEach(section => { section.hidden = section.dataset.view !== state.activeView; });
  document.querySelectorAll('.nav-item[data-section]').forEach(item => item.classList.toggle('active', item.dataset.section === state.activeView));
  document.querySelector('#currentViewTitle').textContent = viewTitles[state.activeView];
  closeMobileMenu(); window.scrollTo({ top: 0, behavior: 'auto' });
  if (updateHash && location.hash !== `#${state.activeView}`) history.pushState(null, '', `#${state.activeView}`);
}

function showToast(message) {
  const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2300);
}
function openModal(id) { const modal = document.querySelector(`#${id}`); modal.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => modal.querySelector('input, select')?.focus(), 10); }
function closeModal(id) { document.querySelector(`#${id}`).hidden = true; document.body.style.overflow = ''; }
function openManagerModal(manager = null) {
  document.querySelector('#managerForm').reset(); document.querySelector('#editManagerId').value = manager?.id || ''; document.querySelector('#managerName').value = manager?.name || '';
  document.querySelector('#managerModalTitle').textContent = manager ? '修改负责人' : '添加负责人'; document.querySelector('#managerSubmit').textContent = manager ? '保存修改' : '添加负责人'; openModal('managerModal');
}
function openPhoneModal(phone = null) {
  renderSelectors(); document.querySelector('#phoneForm').reset(); document.querySelector('#editPhoneId').value = phone?.id || ''; document.querySelector('#phoneNameInput').value = phone?.name || '';
  if (phone) document.querySelector('#phoneManager').value = phone.managerId;
  document.querySelector('#phoneModalTitle').textContent = phone ? '修改手机' : '添加手机'; document.querySelector('#phoneSubmit').textContent = phone ? '保存修改' : '添加手机'; openModal('phoneModal');
}
let activityDraftFields = [];
const defaultProgressOptions = () => [
  { id: 'not_joined', label: '未参加', role: 'none' }, { id: 'joined', label: '已参加', role: 'none' },
  { id: 'in_progress', label: '进行中', role: 'in_progress' }, { id: 'completed', label: '已完成', role: 'completed' }
];
const newDraftField = (type = 'select') => ({ id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: type === 'select' ? '参与进度' : '新字段', type, showInLedger: true, showInStats: true, options: type === 'select' ? defaultProgressOptions() : [] });

function renderActivityFieldBuilder() {
  const builder = document.querySelector('#activityFieldBuilder');
  builder.innerHTML = activityDraftFields.map((field, index) => `<article class="activity-field-card" data-draft-field="${field.id}"><div class="field-card-top"><b>字段 ${index + 1}</b><button type="button" class="copy-button danger-action" data-remove-draft-field="${field.id}" ${activityDraftFields.length === 1 ? 'disabled' : ''}>删除字段</button></div><div class="form-row"><label>字段名称<input data-draft-name="${field.id}" maxlength="40" value="${escapeHtml(field.name)}" placeholder="例如：参与阶段" /></label><label>字段类型<select data-draft-type="${field.id}">${[['select', '下拉选项'], ['checkbox', '勾选'], ['date', '日期'], ['text', '文本'], ['number', '数字']].map(([value, label]) => `<option value="${value}" ${field.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="field-display-options"><label class="switch-label"><input type="checkbox" data-draft-ledger="${field.id}" ${field.showInLedger !== false ? 'checked' : ''} /><span class="switch"></span>显示在钱包管理表</label><label class="switch-label"><input type="checkbox" data-draft-stats="${field.id}" ${field.showInStats !== false ? 'checked' : ''} /><span class="switch"></span>计入统计</label></div>${field.type === 'select' ? `<div class="option-builder"><div class="option-builder-heading"><span>下拉选项与统计口径</span><button type="button" class="copy-button" data-add-draft-option="${field.id}">+ 添加选项</button></div>${field.options.map(option => `<div class="option-builder-row"><input data-draft-option-label="${field.id}:${option.id}" maxlength="24" value="${escapeHtml(option.label)}" placeholder="选项名称" /><select data-draft-option-role="${field.id}:${option.id}"><option value="none" ${option.role === 'none' ? 'selected' : ''}>普通记录</option><option value="completed" ${option.role === 'completed' ? 'selected' : ''}>计为完成</option><option value="in_progress" ${option.role === 'in_progress' ? 'selected' : ''}>计为进行中</option><option value="risk" ${option.role === 'risk' ? 'selected' : ''}>计为风险</option></select><button type="button" class="icon-button" data-remove-draft-option="${field.id}:${option.id}" ${field.options.length <= 2 ? 'disabled' : ''} aria-label="删除选项">×</button></div>`).join('')}</div>` : '<p class="field-builder-note">此字段会逐钱包填写；统计页会显示已填写数量。需要完成、风险等口径时，请使用“下拉选项”字段。</p>'}</article>`).join('');
}

function readActivityDraftFields() {
  return activityDraftFields.map(field => {
    const card = document.querySelector(`[data-draft-field="${field.id}"]`);
    if (!card) return field;
    const next = { ...field, name: card.querySelector(`[data-draft-name="${field.id}"]`)?.value.trim() || field.name, type: card.querySelector(`[data-draft-type="${field.id}"]`)?.value || field.type, showInLedger: card.querySelector(`[data-draft-ledger="${field.id}"]`)?.checked !== false, showInStats: card.querySelector(`[data-draft-stats="${field.id}"]`)?.checked !== false };
    if (next.type === 'select') next.options = (field.options || []).map(option => ({ ...option, label: card.querySelector(`[data-draft-option-label="${field.id}:${option.id}"]`)?.value.trim() || option.label, role: card.querySelector(`[data-draft-option-role="${field.id}:${option.id}"]`)?.value || 'none' }));
    else next.options = [];
    return next;
  });
}

function renderActivityTemplateList() {
  const list = document.querySelector('#activityTemplateList');
  list.innerHTML = walletActivityTemplates.length ? walletActivityTemplates.map(template => `<div class="activity-template-row ${template.archived ? 'archived' : ''}"><span><strong>${escapeHtml(template.name)}</strong><small>${template.archived ? '已归档 · 历史数据保留' : `使用中 · ${templateFields(template).length} 个字段 · 所有钱包通用`}</small></span><span class="row-actions"><button type="button" class="copy-button" data-edit-activity="${template.id}">编辑</button><button type="button" class="copy-button" data-archive-activity="${template.id}">${template.archived ? '恢复' : '归档'}</button></span></div>`).join('') : '<div class="empty-state compact-empty">还没有管理模板。创建后会自动出现在所有钱包中。</div>';
}
function openActivityModal() {
  document.querySelector('#activityForm').reset();
  document.querySelector('#editActivityId').value = '';
  document.querySelector('#activityDescription').value = '';
  activityDraftFields = [newDraftField()]; renderActivityFieldBuilder();
  document.querySelector('#activitySubmit').textContent = '创建管理模板';
  renderActivityTemplateList();
  openModal('activityModal');
}
function renderWalletActivityFields(phoneId, wallet) {
  const container = document.querySelector('#walletActivityFields');
  const templates = activeActivityTemplates();
  if (!templates.length) {
    container.innerHTML = '<div class="activity-fields-empty">尚未创建通用活动。可在“手机管理 → 活动设置”中添加。</div>';
    return;
  }
  const activities = walletActivities(phoneId, wallet);
  container.innerHTML = templates.map(template => `<section class="wallet-template-fields"><div><strong>${escapeHtml(template.name)}</strong>${template.description ? `<small>${escapeHtml(template.description)}</small>` : ''}</div><div class="wallet-template-field-grid">${templateFields(template).map(field => {
    const value = fieldValue(activities, template, field); const key = `${template.id}:${field.id}`;
    if (field.type === 'select') return `<label>${escapeHtml(field.name)}<select data-wallet-activity-field="${key}"><option value="">未填写</option>${(field.options || []).map(option => `<option value="${escapeHtml(option.id)}" ${value === option.id ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
    if (field.type === 'checkbox') return `<label class="wallet-checkbox-field"><input type="checkbox" data-wallet-activity-field="${key}" ${value ? 'checked' : ''} />${escapeHtml(field.name)}</label>`;
    return `<label>${escapeHtml(field.name)}<input type="${field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}" data-wallet-activity-field="${key}" value="${escapeHtml(value)}" ${field.type === 'number' ? 'step="any"' : ''} /></label>`;
  }).join('')}</div></section>`).join('');
}
function openWalletModal(phoneId, wallet) {
  const metadata = walletInfo(phoneId, wallet);
  const now = new Date(); const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  document.querySelector('#walletForm').reset();
  document.querySelector('#editWalletPhone').value = phoneId;
  document.querySelector('#editWalletNumber').value = wallet;
  document.querySelector('#walletNameInput').value = walletLabel(wallet, phoneId);
  document.querySelector('#walletCreatedAt').value = metadata.createdAt || '';
  document.querySelector('#walletCreatedAt').max = localNow;
  document.querySelector('#walletSybilStatus').value = metadata.sybilStatus || 'unreviewed';
  document.querySelector('#walletNote').value = metadata.note || '';
  renderWalletActivityFields(phoneId, wallet);
  document.querySelector('#walletModalTitle').textContent = `${phoneName(phoneId)} · ${walletLabel(wallet, phoneId)}`;
  const rows = allWalletRows(); const currentIndex = rows.findIndex(row => row.key === `${phoneId}:${wallet}`);
  document.querySelector('#previousWalletButton').disabled = currentIndex <= 0; document.querySelector('#nextWalletButton').disabled = currentIndex < 0 || currentIndex >= rows.length - 1;
  openModal('walletModal');
}
function openAdjacentWallet(offset) {
  const key = `${document.querySelector('#editWalletPhone').value}:${document.querySelector('#editWalletNumber').value}`; const rows = allWalletRows(); const index = rows.findIndex(row => row.key === key); const next = rows[index + offset];
  if (next) openWalletModal(next.phone.id, next.wallet);
}
function openAddressModal(phoneId = state.selectedPhone, wallet = 1, record = null) {
  renderSelectors(); renderNetworks(); document.querySelector('#addressForm').reset(); document.querySelector('#editAddressId').value = record?.id || '';
  const targetPhone = record?.phoneId || phoneId; const targetWallet = record?.wallet || wallet;
  document.querySelector('#addressPhone').value = targetPhone; renderAddressWalletOptions(targetPhone, targetWallet);
  if (record) {
    const isLegacyEvm = builtInNetworks.some(network => network.type === 'EVM' && network.name === record.chain) || customNetworks.some(network => network.type === 'EVM' && network.name === record.chain);
    document.querySelector('#addressChain').value = isLegacyEvm ? 'EVM' : record.chain;
    document.querySelector('#addressValue').value = record.address;
  }
  document.querySelector('#addressModalTitle').textContent = record ? '修改链上地址' : '添加链上地址'; document.querySelector('#addressSubmit').textContent = record ? '保存并重新同步' : '添加并更新'; openModal('addressModal');
}

function addressSupportsClientNetwork(addressItem, network) {
  return addressItem?.chain === network.name || (addressItem?.chain === 'EVM' && network.type === 'EVM');
}

function availableTokenNetworks() {
  const all = [...builtInNetworks, ...customNetworks];
  return all.filter(network => addresses.some(addressItem => addressSupportsClientNetwork(addressItem, network)));
}

function renderTokenChainOptions(selectedChain = '') {
  const networks = availableTokenNetworks();
  const select = document.querySelector('#tokenChain');
  select.innerHTML = networks.map(network => `<option value="${escapeHtml(network.name)}">${escapeHtml(network.name)}</option>`).join('');
  if (selectedChain && networks.some(network => network.name === selectedChain)) select.value = selectedChain;
}

function openTokenModal(record = null) {
  if (!addresses.length) { showToast('请先添加钱包地址，再添加币种'); return; }
  const form = document.querySelector('#tokenForm'); form.reset();
  renderTokenChainOptions(record?.chain || '');
  document.querySelector('#editTokenId').value = record?.id || '';
  document.querySelector('#tokenContract').value = record?.contract || '';
  document.querySelector('#tokenSymbol').value = record?.symbol || '';
  document.querySelector('#tokenName').value = record?.name || '';
  document.querySelector('#tokenDecimals').value = record?.decimals ?? 18;
  document.querySelector('#tokenPrice').value = record?.priceMode === 'manual' ? record.manualPrice ?? '' : '';
  const detectStatus = document.querySelector('#tokenDetectStatus'); detectStatus.textContent = record ? `全账户币种 · 已扫描 ${record.scannedAddressCount || 0} 个地址${record.quoteSource === 'stablecoin-fallback' ? ' · 稳定币估值已启用' : record.quoteSource === 'dexscreener' ? ' · 自动报价已启用' : record.priceMode === 'manual' ? ' · 使用手动价格' : ''}` : '输入后会自动读取名称、符号、精度和市场报价'; detectStatus.className = 'field-status';
  document.querySelector('#tokenModalTitle').textContent = record ? '修改自定义币种' : '添加自定义币种';
  document.querySelector('#tokenSubmit').textContent = record ? '保存并重新同步' : '添加并同步';
  openModal('tokenModal');
}

async function detectTokenMetadata() {
  const contract = document.querySelector('#tokenContract').value.trim();
  if (!contract) return;
  const button = document.querySelector('#detectTokenButton'); const status = document.querySelector('#tokenDetectStatus');
  button.disabled = true; button.textContent = '识别中'; status.textContent = '正在读取链上元数据…'; status.className = 'field-status';
  try {
    const metadata = await api('/api/tokens/detect', { method: 'POST', body: JSON.stringify({ chain: document.querySelector('#tokenChain').value, contract }) });
    if (metadata.symbol) document.querySelector('#tokenSymbol').value = metadata.symbol;
    if (metadata.name) document.querySelector('#tokenName').value = metadata.name;
    if (metadata.decimals != null) document.querySelector('#tokenDecimals').value = metadata.decimals;
    const quoteText = metadata.quote?.price != null ? ` · 自动报价 ${money(metadata.quote.price)}${metadata.quote.liquidityUsd != null ? ` · 流动性 ${money(metadata.quote.liquidityUsd)}` : ''}` : ' · 暂未找到可用 DEX 报价';
    status.textContent = `${metadata.warning || `已识别：${metadata.symbol || '未返回符号'} · ${metadata.name || '未返回名称'} · ${metadata.decimals ?? '未返回精度'} decimals`}${quoteText}`;
    status.className = `field-status ${metadata.quote?.price != null && !metadata.warning ? 'success' : ''}`;
  } catch (error) { status.textContent = error.message; status.className = 'field-status error'; }
  finally { button.disabled = false; button.textContent = '自动识别'; }
}

function renderSyncScopeOptions() {
  document.querySelector('#syncManager').innerHTML = managers.map(manager => `<option value="${manager.id}">${escapeHtml(manager.name)}</option>`).join('');
  const phoneSelect = document.querySelector('#syncPhone');
  const previousPhone = phoneSelect.value;
  phoneSelect.innerHTML = phones.map(phone => `<option value="${phone.id}">${escapeHtml(phone.name)} · ${escapeHtml(managerForPhone(phone.id)?.name || '未分配')}</option>`).join('');
  phoneSelect.value = phones.some(phone => phone.id === previousPhone) ? previousPhone : phones.some(phone => phone.id === state.selectedPhone) ? state.selectedPhone : phones[0]?.id || '';
  const count = walletCountFor(phoneSelect.value);
  document.querySelector('#syncWallet').innerHTML = Array.from({ length: count }, (_, index) => `<option value="${index + 1}">${escapeHtml(walletLabel(index + 1, phoneSelect.value))}</option>`).join('');
  const scope = document.querySelector('#syncScope').value;
  document.querySelector('#syncManagerField').hidden = scope !== 'manager';
  document.querySelector('#syncPhoneField').hidden = !['phone', 'wallet'].includes(scope);
  document.querySelector('#syncWalletField').hidden = scope !== 'wallet';
}

function openSyncModal() { renderSyncScopeOptions(); document.querySelector('#syncDeepDiscovery').checked = false; openModal('syncModal'); }

async function performSync(manual = false, options = { scope: 'all' }) {
  if (syncInFlight) return;
  syncInFlight = true;
  const button = document.querySelector('#refreshButton'); button.disabled = true; button.innerHTML = '<span>↻</span>更新中';
  try {
    applyBackendState(await api('/api/sync', { method: 'POST', body: JSON.stringify(options) })); renderAll();
    showToast(manual ? '所选范围已完成更新，下一次已随机安排' : '后台随机批次已完成');
  } catch (error) { showToast(`同步失败：${error.message}`); }
  finally { syncInFlight = false; button.disabled = false; button.innerHTML = '<span>↻</span>手动更新'; }
}
function updateSyncCountdown() {
  const nextAt = Date.parse(scheduler.nextBatchAt);
  const remaining = Number.isFinite(nextAt) ? Math.max(0, nextAt - Date.now()) : null;
  const nextLabel = remaining == null ? '等待安排' : remaining < 60_000 ? '即将开始' : remaining < 60 * 60_000
    ? `${Math.ceil(remaining / 60_000)} 分钟后`
    : `${Math.floor(remaining / (60 * 60_000))} 小时 ${Math.ceil((remaining % (60 * 60_000)) / 60_000)} 分后`;
  document.querySelector('#syncTime').textContent = `下一批约 ${nextLabel} · 每地址 ${scheduler.minIntervalHours || 10}–${scheduler.maxIntervalHours || 24} 小时`;
}

document.querySelector('#phoneSearch').addEventListener('input', event => { state.phoneSearch = event.target.value; state.expandedSections.phones = false; renderPhones(); });
document.querySelector('#managerFilter').addEventListener('change', event => { state.managerFilter = event.target.value; state.expandedSections.phones = false; renderPhones(); });
document.querySelector('#statsManagerFilter').addEventListener('change', event => { state.statsManager = event.target.value; state.statsPhone = 'all'; state.expandedSections.statsMatrix = false; renderWalletStats(); });
document.querySelector('#statsPhoneFilter').addEventListener('change', event => { state.statsPhone = event.target.value; state.expandedSections.statsMatrix = false; renderWalletStats(); });
document.querySelector('#statsSybilFilter').addEventListener('change', event => { state.statsSybil = event.target.value; state.expandedSections.statsMatrix = false; renderWalletStats(); });
document.querySelector('#statsWalletSearch').addEventListener('input', event => { state.statsSearch = event.target.value; state.expandedSections.statsMatrix = false; renderWalletStats(); });
document.querySelector('#showArchivedActivities').addEventListener('change', event => { state.showArchivedActivities = event.target.checked; renderWalletStats(); });
document.querySelector('#bulkStatusField').addEventListener('change', () => renderBulkStatusValues());
document.querySelector('#statsManageActivitiesButton').addEventListener('click', () => openActivityModal());
document.querySelector('#exportWalletStatsButton').addEventListener('click', () => exportWalletStats());
document.querySelector('#exportAssetsButton').addEventListener('click', () => exportAssets());
document.querySelector('#walletStatCards').addEventListener('click', event => { const card = event.target.closest('[data-stat-card-filter]'); if (!card) return; state.statsSybil = card.dataset.statCardFilter; state.expandedSections.statsMatrix = false; renderWalletStats(); document.querySelector('.matrix-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
document.querySelector('#matrixDensity').addEventListener('click', event => { const button = event.target.closest('[data-density]'); if (!button) return; state.matrixDensity = button.dataset.density; localStorage.setItem('chainfolio_matrix_density_v1', state.matrixDensity); renderWalletStats(); });
document.querySelector('#matrixColumnPicker').addEventListener('change', event => { const input = event.target.closest('[data-matrix-column]'); if (!input) return; if (input.checked) matrixHiddenColumns.delete(input.dataset.matrixColumn); else matrixHiddenColumns.add(input.dataset.matrixColumn); localStorage.setItem('chainfolio_matrix_hidden_v1', JSON.stringify([...matrixHiddenColumns])); renderWalletStats(); });
document.querySelector('#managerStatsBody').addEventListener('click', event => { const button = event.target.closest('[data-stats-manager-link]'); if (!button) return; state.statsManager = button.dataset.statsManagerLink; state.statsPhone = 'all'; state.expandedSections.statsMatrix = false; renderWalletStats(); document.querySelector('.matrix-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
document.querySelector('#selectAllStatsWallets').addEventListener('change', event => {
  const pageRows = visibleItems(filteredWalletStatRows(), 'statsMatrix'); pageRows.forEach(row => { if (event.target.checked) selectedStatsWallets.add(row.key); else selectedStatsWallets.delete(row.key); }); renderWalletStats();
});
document.querySelector('#walletMatrixBody').addEventListener('click', event => {
  const edit = event.target.closest('[data-stats-edit-wallet]'); if (!edit) return;
  const [phoneId, walletText] = edit.dataset.statsEditWallet.split(':'); openWalletModal(phoneId, Number(walletText));
});
document.querySelector('#walletMatrixBody').addEventListener('change', async event => {
  const checkbox = event.target.closest('[data-stats-wallet-select]');
  if (checkbox) { if (checkbox.checked) selectedStatsWallets.add(checkbox.dataset.statsWalletSelect); else selectedStatsWallets.delete(checkbox.dataset.statsWalletSelect); document.querySelector('#selectedWalletCount').textContent = `已选择 ${selectedStatsWallets.size} 个钱包`; return; }
  const input = event.target.closest('[data-matrix-field]'); if (!input) return;
  const value = input.type === 'checkbox' ? input.checked : input.value;
  try { applyBackendState(await api('/api/wallets/bulk-status', { method: 'POST', body: JSON.stringify({ walletKeys: [input.dataset.walletKey], field: input.dataset.matrixField, value }) })); renderAll(); showToast('钱包状态已更新'); }
  catch (error) { showToast(error.message); renderWalletStats(); }
});
document.querySelector('#applyBulkStatusButton').addEventListener('click', async () => {
  if (!selectedStatsWallets.size) { showToast('请先选择要修改的钱包'); return; }
  const field = document.querySelector('#bulkStatusField').value; const value = document.querySelector('#bulkStatusValue').value;
  if (!confirm(`确定为选中的 ${selectedStatsWallets.size} 个钱包批量设置“${document.querySelector('#bulkStatusValue').selectedOptions[0]?.textContent || value}”吗？`)) return;
  try { applyBackendState(await api('/api/wallets/bulk-status', { method: 'POST', body: JSON.stringify({ walletKeys: [...selectedStatsWallets], field, value }) })); selectedStatsWallets.clear(); renderAll(); showToast('批量状态已更新'); }
  catch (error) { showToast(error.message); }
});
document.querySelector('#allocationMode').addEventListener('click', event => {
  const button = event.target.closest('[data-allocation-mode]');
  if (!button) return;
  state.allocationMode = button.dataset.allocationMode;
  renderOverview();
});
document.querySelector('#netWorthRange').addEventListener('change', event => {
  state.netWorthRange = event.target.value;
  const dateInput = document.querySelector('#netWorthDate');
  dateInput.hidden = state.netWorthRange !== 'custom';
  if (state.netWorthRange === 'custom' && !state.netWorthDate) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    state.netWorthDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    dateInput.value = state.netWorthDate;
  }
  renderOverview();
});
document.querySelector('#netWorthDate').max = new Date().toISOString().slice(0, 10);
document.querySelector('#netWorthDate').addEventListener('change', event => { state.netWorthDate = event.target.value; renderOverview(); });
document.addEventListener('click', event => {
  const button = event.target.closest('[data-expand-section]');
  if (!button) return;
  const section = button.dataset.expandSection;
  state.expandedSections[section] = !state.expandedSections[section];
  const renderers = { managers: renderManagers, phones: renderPhones, statsMatrix: renderWalletStats, addresses: renderAddresses, assets: renderAssets, networks: renderNetworks, users: () => renderAdminData(adminUsers, adminInvites), invites: () => renderAdminData(adminUsers, adminInvites) };
  renderers[section]?.();
});
document.querySelector('#managerGrid').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-manager]');
  if (edit) { openManagerModal(managers.find(item => item.id === edit.dataset.editManager)); return; }
  const remove = event.target.closest('[data-delete-manager]');
  if (!remove) return;
  const manager = managers.find(item => item.id === remove.dataset.deleteManager); if (!manager || !confirm(`确定删除负责人“${manager.name}”吗？其名下有手机时需要先重新分配。`)) return;
  try { applyBackendState(await api(`/api/managers/${manager.id}`, { method: 'DELETE' })); renderAll(); showToast('负责人已删除'); } catch (error) { showToast(error.message); }
});
document.querySelector('#phoneTableBody').addEventListener('click', async event => {
  const addWallet = event.target.closest('[data-phone-add-wallet]');
  if (addWallet) {
    const phoneId = addWallet.dataset.phoneAddWallet; const current = walletCountFor(phoneId);
    if (current >= 10) { showToast('每台手机最多 10 个钱包'); return; }
    try { applyBackendState(await api(`/api/phones/${phoneId}/wallets`, { method: 'POST', body: '{}' })); state.selectedPhone = phoneId; state.expandedPhoneId = phoneId; renderAll(); showToast(`${phoneName(phoneId)}已添加钱包 ${current + 1}`); }
    catch (error) { showToast(error.message); }
    return;
  }
  const deleteWallet = event.target.closest('[data-phone-wallet-delete]');
  if (deleteWallet) {
    const phoneId = deleteWallet.dataset.phoneId; const wallet = Number(deleteWallet.dataset.phoneWalletDelete);
    if (!confirm(`确定删除“${walletLabel(wallet, phoneId)}”吗？其中的地址和资产记录会一起删除，后续钱包编号会自动前移。`)) return;
    try { applyBackendState(await api(`/api/phones/${phoneId}/wallets/${wallet}`, { method: 'DELETE' })); state.selectedPhone = phoneId; state.expandedPhoneId = phoneId; renderAll(); showToast('钱包及其下属数据已删除'); }
    catch (error) { showToast(error.message); }
    return;
  }
  const editWalletProfile = event.target.closest('[data-phone-wallet-edit]');
  if (editWalletProfile) { openWalletModal(editWalletProfile.dataset.phoneId, Number(editWalletProfile.dataset.phoneWalletEdit)); return; }
  const addWalletAddress = event.target.closest('[data-phone-wallet-address]');
  if (addWalletAddress) { openAddressModal(addWalletAddress.dataset.phoneId, Number(addWalletAddress.dataset.phoneWalletAddress)); return; }
  const view = event.target.closest('[data-view-phone]');
  if (view) { state.selectedPhone = view.dataset.viewPhone; state.expandedPhoneId = state.expandedPhoneId === view.dataset.viewPhone ? '' : view.dataset.viewPhone; renderSelectors(); renderPhones(); return; }
  const edit = event.target.closest('[data-edit-phone]');
  if (edit) { openPhoneModal(phones.find(item => item.id === edit.dataset.editPhone)); return; }
  const remove = event.target.closest('[data-delete-phone]');
  if (!remove) return;
  const phone = phones.find(item => item.id === remove.dataset.deletePhone); if (!phone || !confirm(`确定删除“${phone.name}”吗？其下所有钱包、地址和资产记录都会一起删除。`)) return;
  try { applyBackendState(await api(`/api/phones/${phone.id}`, { method: 'DELETE' })); state.selectedPhone = phones[0]?.id || ''; if (state.expandedPhoneId === phone.id) state.expandedPhoneId = ''; renderAll(); showToast('手机及其下属数据已删除'); } catch (error) { showToast(error.message); }
});
document.querySelector('#phoneTableBody').addEventListener('change', async event => {
  const select = event.target.closest('[data-phone-manager]'); if (!select) return;
  const phone = phones.find(item => item.id === select.dataset.phoneManager); if (!phone) return;
  try { applyBackendState(await api(`/api/phones/${phone.id}/manager`, { method: 'PATCH', body: JSON.stringify({ managerId: select.value }) })); renderAll(); showToast(`${phone.name}已分配给${managerById(select.value)?.name || '负责人'}`); }
  catch (error) { showToast(error.message); renderPhones(); }
});
document.querySelector('#addressPhone').addEventListener('change', event => renderAddressWalletOptions(event.target.value));
document.querySelector('#addressPhoneFilter').addEventListener('change', event => { state.addressPhone = event.target.value; state.expandedSections.addresses = false; renderAddresses(); });
document.querySelector('#addAddressButton').addEventListener('click', () => openAddressModal());
document.querySelector('#addressSectionAdd').addEventListener('click', () => openAddressModal());
document.querySelector('#addManagerButton').addEventListener('click', () => openManagerModal());
document.querySelector('#addPhoneButton').addEventListener('click', () => openPhoneModal());
document.querySelector('#refreshButton').addEventListener('click', () => openSyncModal());
document.querySelector('#previousWalletButton').addEventListener('click', () => openAdjacentWallet(-1));
document.querySelector('#nextWalletButton').addEventListener('click', () => openAdjacentWallet(1));
document.querySelector('#addNetworkButton').addEventListener('click', () => openModal('networkModal'));
document.querySelector('#addTokenButton').addEventListener('click', () => openTokenModal());
document.querySelector('#tokenChain').addEventListener('change', () => { document.querySelector('#tokenDetectStatus').textContent = '区块链已切换，请重新识别'; });
document.querySelector('#detectTokenButton').addEventListener('click', () => detectTokenMetadata());
document.querySelector('#tokenContract').addEventListener('change', () => detectTokenMetadata());
document.querySelector('#syncScope').addEventListener('change', () => renderSyncScopeOptions());
document.querySelector('#syncPhone').addEventListener('change', () => renderSyncScopeOptions());
document.querySelector('#assetSearch').addEventListener('input', event => { state.search = event.target.value; state.expandedSections.assets = false; renderAssets(); });
document.querySelector('#smallBalanceToggle').addEventListener('change', event => { state.hideSmall = event.target.checked; state.expandedSections.assets = false; renderAssets(); });
document.querySelector('#chainFilter').addEventListener('click', event => { const button = event.target.closest('[data-chain]'); if (!button) return; state.chain = button.dataset.chain; state.expandedSections.assets = false; renderChainFilters(); renderAssets(); });
document.querySelector('#privacyButton').addEventListener('click', () => { applyPrivacyMode(!state.privacy); renderAll(); applyPrivacyMode(state.privacy, false); });

document.querySelector('#managerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.querySelector('#managerName').value.trim();
  const editId = document.querySelector('#editManagerId').value;
  try { applyBackendState(await api(editId ? `/api/managers/${editId}` : '/api/managers', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify({ name }) })); closeModal('managerModal'); event.target.reset(); renderAll(); showToast(editId ? '负责人名称已修改' : `已添加负责人“${name}”`); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#phoneForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.querySelector('#phoneNameInput').value.trim();
  const managerId = document.querySelector('#phoneManager').value;
  const editId = document.querySelector('#editPhoneId').value;
  try { applyBackendState(await api(editId ? `/api/phones/${editId}` : '/api/phones', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify({ name, managerId }) })); if (!editId) state.selectedPhone = phones[phones.length - 1].id; state.managerFilter = 'all'; closeModal('phoneModal'); event.target.reset(); renderAll(); showToast(editId ? '手机信息已修改' : `${name}已添加到${managerById(managerId)?.name || '负责人'}名下`); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#activityForm').addEventListener('submit', async event => {
  event.preventDefault();
  const name = document.querySelector('#activityName').value.trim();
  const editId = document.querySelector('#editActivityId').value;
  const description = document.querySelector('#activityDescription').value.trim();
  const fields = readActivityDraftFields();
  try {
    applyBackendState(await api(editId ? `/api/wallet-activities/${editId}` : '/api/wallet-activities', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify({ name, description, fields }) }));
    event.target.reset(); document.querySelector('#editActivityId').value = ''; document.querySelector('#activityDescription').value = ''; activityDraftFields = [newDraftField()]; renderActivityFieldBuilder(); document.querySelector('#activitySubmit').textContent = '创建管理模板'; renderActivityTemplateList(); renderAll();
    showToast(editId ? '管理模板已保存' : '管理模板已添加到全部钱包');
  } catch (error) { showToast(error.message); }
});

document.querySelector('#activityFieldBuilder').addEventListener('click', event => {
  const removeField = event.target.closest('[data-remove-draft-field]');
  if (removeField) { activityDraftFields = readActivityDraftFields().filter(field => field.id !== removeField.dataset.removeDraftField); renderActivityFieldBuilder(); return; }
  const addOption = event.target.closest('[data-add-draft-option]');
  if (addOption) { activityDraftFields = readActivityDraftFields(); const field = activityDraftFields.find(item => item.id === addOption.dataset.addDraftOption); if (field) field.options.push({ id: `option_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, label: '新选项', role: 'none' }); renderActivityFieldBuilder(); return; }
  const removeOption = event.target.closest('[data-remove-draft-option]');
  if (removeOption) { const [fieldId, optionId] = removeOption.dataset.removeDraftOption.split(':'); activityDraftFields = readActivityDraftFields(); const field = activityDraftFields.find(item => item.id === fieldId); if (field) field.options = field.options.filter(option => option.id !== optionId); renderActivityFieldBuilder(); }
});
document.querySelector('#activityFieldBuilder').addEventListener('change', event => {
  const type = event.target.closest('[data-draft-type]'); if (!type) return;
  activityDraftFields = readActivityDraftFields(); const field = activityDraftFields.find(item => item.id === type.dataset.draftType); if (!field) return;
  field.type = type.value; if (field.type === 'select' && !field.options.length) field.options = defaultProgressOptions(); renderActivityFieldBuilder();
});
document.querySelector('#addActivityFieldButton').addEventListener('click', () => { activityDraftFields = readActivityDraftFields(); activityDraftFields.push(newDraftField()); renderActivityFieldBuilder(); });

document.querySelector('#activityTemplateList').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-activity]');
  if (edit) {
    const activity = walletActivityTemplates.find(item => item.id === edit.dataset.editActivity);
    if (!activity) return;
    document.querySelector('#editActivityId').value = activity.id; document.querySelector('#activityName').value = activity.name; document.querySelector('#activityDescription').value = activity.description || ''; activityDraftFields = structuredClone(templateFields(activity)); renderActivityFieldBuilder(); document.querySelector('#activitySubmit').textContent = '保存管理模板'; document.querySelector('#activityName').focus();
    return;
  }
  const archive = event.target.closest('[data-archive-activity]');
  if (!archive) return;
  const activity = walletActivityTemplates.find(item => item.id === archive.dataset.archiveActivity);
  if (!activity || !confirm(`${activity.archived ? '恢复' : '归档'}活动“${activity.name}”吗？${activity.archived ? '它会重新出现在钱包编辑和矩阵中。' : '历史进度会保留，可随时恢复。'}`)) return;
  try { applyBackendState(await api(`/api/wallet-activities/${activity.id}`, { method: 'PATCH', body: JSON.stringify({ archived: !activity.archived }) })); renderActivityTemplateList(); renderAll(); showToast(activity.archived ? '活动已恢复' : '活动已归档，历史进度保留'); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#walletForm').addEventListener('submit', async event => {
  event.preventDefault();
  const phoneId = document.querySelector('#editWalletPhone').value;
  const wallet = Number(document.querySelector('#editWalletNumber').value);
  const activityValues = {};
  document.querySelectorAll('[data-wallet-activity-field]').forEach(input => { const [templateId, fieldId] = input.dataset.walletActivityField.split(':'); (activityValues[templateId] ||= {})[fieldId] = input.type === 'checkbox' ? input.checked : input.value; });
  const payload = { name: document.querySelector('#walletNameInput').value.trim(), createdAt: document.querySelector('#walletCreatedAt').value, sybilStatus: document.querySelector('#walletSybilStatus').value, note: document.querySelector('#walletNote').value.trim(), activityValues };
  try { applyBackendState(await api(`/api/phones/${phoneId}/wallets/${wallet}`, { method: 'PATCH', body: JSON.stringify(payload) })); closeModal('walletModal'); event.target.reset(); renderAll(); showToast('钱包资料已保存'); } catch (error) { showToast(error.message); }
});

document.querySelector('#addressForm').addEventListener('submit', async event => {
  event.preventDefault(); const phoneId = document.querySelector('#addressPhone').value; const wallet = Number(document.querySelector('#addressWallet').value); const chain = document.querySelector('#addressChain').value; const address = document.querySelector('#addressValue').value.trim();
  const editId = document.querySelector('#editAddressId').value;
  try { applyBackendState(await api(editId ? `/api/addresses/${editId}` : '/api/addresses', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify({ phoneId, wallet, chain, address }) })); state.selectedPhone = phoneId; closeModal('addressModal'); event.target.reset(); renderAll(); showToast(editId ? '地址信息已修改' : `${phoneName(phoneId)} · ${walletLabel(wallet, phoneId)} 地址已保存到后端`); await performSync(true); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#networkForm').addEventListener('submit', async event => {
  event.preventDefault(); const network = { name: document.querySelector('#networkName').value.trim(), symbol: document.querySelector('#networkSymbol').value.trim().toUpperCase(), chainId: document.querySelector('#networkChainId').value.trim(), rpc: document.querySelector('#networkRpc').value.trim(), type: 'EVM', color: '#ffbd66' };
  try { applyBackendState(await api('/api/networks', { method: 'POST', body: JSON.stringify(network) })); closeModal('networkModal'); event.target.reset(); renderAll(); showToast(`已导入 ${network.name}`); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#tokenForm').addEventListener('submit', async event => {
  event.preventDefault();
  const token = {
    chain: document.querySelector('#tokenChain').value,
    contract: document.querySelector('#tokenContract').value.trim(),
    symbol: document.querySelector('#tokenSymbol').value.trim(),
    name: document.querySelector('#tokenName').value.trim(),
    decimals: Number(document.querySelector('#tokenDecimals').value),
    price: document.querySelector('#tokenPrice').value.trim()
  };
  const editId = document.querySelector('#editTokenId').value;
  try {
    applyBackendState(await api(editId ? `/api/tokens/${editId}` : '/api/tokens', { method: editId ? 'PATCH' : 'POST', body: JSON.stringify(token) }));
    closeModal('tokenModal'); event.target.reset(); renderAll(); showToast(editId ? '币种配置已修改' : `${token.symbol.toUpperCase()} 已添加`); await performSync(true);
  } catch (error) { showToast(error.message); }
});

document.querySelector('#syncForm').addEventListener('submit', async event => {
  event.preventDefault();
  const scope = document.querySelector('#syncScope').value;
  const options = { scope };
  if (scope === 'manager') options.managerId = document.querySelector('#syncManager').value;
  if (scope === 'phone' || scope === 'wallet') options.phoneId = document.querySelector('#syncPhone').value;
  if (scope === 'wallet') options.wallet = Number(document.querySelector('#syncWallet').value);
  options.deepDiscovery = document.querySelector('#syncDeepDiscovery').checked;
  closeModal('syncModal'); await performSync(true, options);
});

document.querySelector('#assetTableBody').addEventListener('click', async event => {
  const edit = event.target.closest('[data-edit-token]');
  if (edit) {
    const token = customTokens.find(item => item.id === edit.dataset.editToken);
    if (token?.system) { showToast('系统稳定币由系统自动维护，不能编辑'); return; }
    openTokenModal(token); return;
  }
  const remove = event.target.closest('[data-delete-token]');
  if (!remove) return;
  const token = customTokens.find(item => item.id === remove.dataset.deleteToken);
  if (token?.system) { showToast('系统稳定币由系统自动维护，不能删除'); return; }
  if (!token || !confirm(`确定删除自定义币种 ${token.symbol} 吗？对应的余额记录也会删除。`)) return;
  try { applyBackendState(await api(`/api/tokens/${token.id}`, { method: 'DELETE' })); renderAll(); showToast(`${token.symbol} 已删除`); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#addressList').addEventListener('click', async event => {
  const copy = event.target.closest('[data-copy]');
  if (copy) { try { await navigator.clipboard.writeText(copy.dataset.copy); showToast('地址已复制'); } catch { showToast('复制失败，请手动选择地址'); } return; }
  const edit = event.target.closest('[data-edit-address]');
  if (edit) { openAddressModal(state.selectedPhone, 1, addresses.find(item => item.id === edit.dataset.editAddress)); return; }
  const remove = event.target.closest('[data-delete-address]');
  if (!remove) return;
  const item = addresses.find(entry => entry.id === remove.dataset.deleteAddress); if (!item || !confirm(`确定删除 ${item.chain === 'EVM' ? 'EVM 多链' : item.chain}地址吗？该地址对应的资产记录也会删除。`)) return;
  try { applyBackendState(await api(`/api/addresses/${item.id}`, { method: 'DELETE' })); renderAll(); showToast('地址及其资产记录已删除'); } catch (error) { showToast(error.message); }
});

document.querySelectorAll('[data-auth-tab]').forEach(button => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));
document.querySelectorAll('[data-font-scale]').forEach(select => select.addEventListener('change', event => applyFontScale(event.target.value)));
document.querySelector('#setupForm').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('#authError'); error.textContent = '';
  const password = document.querySelector('#setupPassword').value;
  if (password !== document.querySelector('#setupPasswordConfirm').value) { error.textContent = '两次输入的密码不一致'; return; }
  try {
    const payload = await api('/api/setup/owner', { method: 'POST', body: JSON.stringify({ username: document.querySelector('#setupUsername').value.trim(), password }) });
    instanceAuth = { needsSetup: false, registrationMode: 'disabled', registrationEnabled: false };
    applySession(payload); event.target.reset(); await loadBackendState(); await loadAdminData(); showToast('本地主账户创建成功');
  } catch (setupError) { error.textContent = setupError.message; }
});

document.querySelector('#loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('#authError'); error.textContent = '';
  try {
    const payload = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: document.querySelector('#loginUsername').value.trim(), password: document.querySelector('#loginPassword').value }) });
    applySession(payload); event.target.reset(); await loadBackendState(); if (currentUser.role === 'admin') await loadAdminData();
  } catch (loginError) { error.textContent = loginError.message; }
});

document.querySelector('#registerForm').addEventListener('submit', async event => {
  event.preventDefault();
  const error = document.querySelector('#authError'); error.textContent = '';
  const password = document.querySelector('#registerPassword').value;
  if (password !== document.querySelector('#registerPasswordConfirm').value) { error.textContent = '两次输入的密码不一致'; return; }
  try {
    const payload = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ inviteCode: document.querySelector('#registerInvite').value.trim(), username: document.querySelector('#registerUsername').value.trim(), password }) });
    applySession(payload); event.target.reset(); await loadBackendState(); showToast('账户创建成功');
  } catch (registerError) { error.textContent = registerError.message; }
});

document.querySelector('#profileButton').addEventListener('click', () => openModal('accountModal'));
document.querySelector('#passwordForm').addEventListener('submit', async event => {
  event.preventDefault();
  const newPassword = document.querySelector('#newPassword').value;
  if (newPassword !== document.querySelector('#newPasswordConfirm').value) { showToast('两次输入的新密码不一致'); return; }
  try {
    const payload = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: document.querySelector('#currentPassword').value, newPassword }) });
    applySession(payload); event.target.reset(); closeModal('accountModal'); showToast('密码已更新，其他设备已退出');
  } catch (error) { showToast(error.message); }
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* cookie is cleared when possible */ }
  showAuthScreen(); setAuthTab('login');
});

document.querySelector('#inviteForm').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const payload = await api('/api/admin/invites', { method: 'POST', body: JSON.stringify({ label: document.querySelector('#inviteLabel').value.trim() }) });
    document.querySelector('#inviteCode').textContent = payload.invite.code;
    document.querySelector('#inviteResult').hidden = false;
    event.target.reset(); await loadAdminData();
  } catch (error) { showToast(error.message); }
});

document.querySelector('#saveRegistrationMode').addEventListener('click', async () => {
  try {
    const registrationMode = document.querySelector('#registrationModeSelect').value;
    const payload = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ registrationMode }) });
    adminSettings = payload.settings;
    instanceAuth.registrationMode = registrationMode;
    instanceAuth.registrationEnabled = registrationMode === 'invite';
    await loadAdminData();
    showToast(registrationMode === 'invite' ? '团队邀请码注册已开启' : '团队注册已关闭');
  } catch (error) { showToast(error.message); }
});

document.querySelector('#copyInviteButton').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.querySelector('#inviteCode').textContent); showToast('邀请码已复制'); }
  catch { showToast('复制失败，请手动复制邀请码'); }
});
document.querySelector('#guide').addEventListener('click', async event => {
  const copy = event.target.closest('[data-author-copy]');
  if (!copy) return;
  try { await navigator.clipboard.writeText(copy.dataset.authorCopy); showToast('OKX 钱包邀请码已复制'); }
  catch { showToast('复制失败，请手动复制邀请码：527527'); }
});

document.querySelector('#inviteList').addEventListener('click', async event => {
  const button = event.target.closest('[data-revoke-invite]');
  if (!button || !confirm('确定撤销这个尚未使用的邀请码吗？')) return;
  try { await api(`/api/admin/invites/${button.dataset.revokeInvite}`, { method: 'DELETE' }); await loadAdminData(); showToast('邀请码已撤销'); }
  catch (error) { showToast(error.message); }
});

document.querySelector('#userList').addEventListener('click', async event => {
  const button = event.target.closest('[data-user-status]');
  if (!button) return;
  const action = button.dataset.nextStatus === 'disabled' ? '停用' : '启用';
  if (!confirm(`确定${action}这个账户吗？`)) return;
  try { await api(`/api/admin/users/${button.dataset.userStatus}`, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.nextStatus }) }); await loadAdminData(); showToast(`账户已${action}`); }
  catch (error) { showToast(error.message); }
});

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.modal-backdrop').forEach(modal => modal.addEventListener('click', event => { if (event.target === modal) closeModal(modal.id); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(modal => closeModal(modal.id)); });
document.querySelectorAll('.nav-item[data-section]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); setActiveView(link.dataset.section); }));
document.querySelectorAll('[data-open-view]').forEach(button => button.addEventListener('click', () => { if (button.dataset.overviewFilter) state.statsSybil = button.dataset.overviewFilter; setActiveView(button.dataset.openView); renderWalletStats(); }));
document.querySelector('#guide').addEventListener('click', event => {
  const topic = event.target.closest('[data-guide-scroll]');
  if (topic) {
    document.querySelectorAll('[data-guide-scroll]').forEach(button => button.classList.toggle('active', button === topic));
    document.querySelector(`#${topic.dataset.guideScroll}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const action = event.target.closest('[data-guide-action]')?.dataset.guideAction;
  if (!action) return;
  const openView = view => setActiveView(view);
  const later = callback => requestAnimationFrame(callback);
  if (action === 'add-manager') { openView('managers'); later(() => openManagerModal()); return; }
  if (action === 'add-phone') { openView('phones'); later(() => openPhoneModal()); return; }
  if (action === 'add-address') { openView('addresses'); later(() => openAddressModal()); return; }
  if (action === 'open-wallets') {
    openView('phones');
    later(() => { state.selectedPhone = state.selectedPhone || phones[0]?.id || ''; state.expandedPhoneId = state.selectedPhone; renderPhones(); });
    return;
  }
  if (action === 'open-overview') { openView('overview'); return; }
  if (action === 'open-wallet-stats') { openView('wallet-stats'); return; }
  if (action === 'manage-activities') { openView('wallet-stats'); later(() => openActivityModal()); return; }
  if (action === 'add-token') { openView('assets'); later(() => openTokenModal()); return; }
  if (action === 'add-network') { openView('networks'); later(() => openModal('networkModal')); return; }
  if (action === 'manual-sync') { openView('overview'); later(() => openSyncModal()); }
});
document.querySelector('#mobileMenuButton').addEventListener('click', () => { const open = !document.body.classList.contains('mobile-nav-open'); document.body.classList.toggle('mobile-nav-open', open); document.querySelector('#mobileMenuButton').setAttribute('aria-expanded', String(open)); document.querySelector('#mobileNavOverlay').hidden = !open; });
document.querySelector('#mobileNavOverlay').addEventListener('click', () => closeMobileMenu());
window.addEventListener('hashchange', () => { if (currentUser) setActiveView(location.hash.slice(1), false); });

renderAll();
applyPrivacyMode(state.privacy, false);
initializeAuth();
updateSyncCountdown();
setInterval(updateSyncCountdown, 1000);
setInterval(() => { if (currentUser && ![...document.querySelectorAll('.modal-backdrop')].some(modal => !modal.hidden)) loadBackendState(); }, 60 * 1000);
