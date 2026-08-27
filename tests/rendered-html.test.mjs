import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("routes the site entry to the Chainfolio dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/index.html");

  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Chainfolio — 多链资产总账<\/title>/);
  assert.match(html, /id="addTokenButton"/);
  assert.match(html, /id="tokenModal"/);
  assert.match(html, /id="detectTokenButton"/);
  assert.match(html, /id="syncModal"/);
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="setupForm"/);
  assert.match(html, /创建本地主账户/);
  assert.match(html, /id="registerForm"/);
  assert.match(html, /id="inviteForm"/);
  assert.match(html, /data-font-scale/);
  assert.match(html, /EVM 合约币或 Solana SPL 币/);
  assert.match(html, /id="allocationDonut"/);
  assert.match(html, /id="allocationLegend"/);
  assert.match(html, /data-allocation-mode="chain"/);
  assert.match(html, /data-allocation-mode="token"/);
  assert.match(html, /id="netWorthRange"/);
  assert.match(html, /id="netWorthDate"/);
  assert.match(html, /id="assetListControl"/);
  assert.match(html, /id="phoneListControl"/);
  assert.match(html, /id="walletCreatedAt"/);
  assert.match(html, /id="walletSybilStatus"/);
  assert.match(html, /id="walletNote"/);
  assert.match(html, /id="mobileMenuButton"/);
  assert.match(html, /10–24 小时随机更新/);
  assert.match(html, /data-view="wallet-stats"/);
  assert.match(html, /data-open-view="wallet-stats"/);
  assert.match(html, /id="matrixDensity"/);
  assert.match(html, /id="matrixColumnPicker"/);
  assert.match(html, /wallet-drawer-panel/);
  assert.match(html, /id="activityModal"/);
  assert.match(html, /id="walletActivityFields"/);
  assert.match(html, /id="wallet-stats"/);
  assert.match(html, /id="walletStatCards"/);
  assert.match(html, /id="walletMatrixHead"/);
  assert.match(html, /id="bulkStatusField"/);
  assert.match(html, /id="exportWalletStatsButton"/);
  assert.match(html, /id="exportAssetsButton"/);
  assert.match(html, /id="guide" data-view="guide"/);
  assert.match(html, /我要做什么|账户管理/);
  assert.match(html, /data-guide-action="add-manager"/);
  assert.match(html, /data-guide-action="manage-activities"/);
  assert.match(html, /data-guide-action="add-token"/);
  assert.match(html, /待检查/);
  assert.match(html, /疑似女巫/);
  assert.match(html, /全账户识别与自动报价/);
  assert.doesNotMatch(html, /id="tokenAddress"/);
});

test("wires custom token persistence, sync, editing, and deletion", async () => {
  const [client, server] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(client, /openTokenModal/);
  assert.match(client, /\/api\/tokens/);
  assert.match(client, /data-edit-token/);
  assert.match(client, /data-delete-token/);
  assert.match(server, /syncCustomToken/);
  assert.match(server, /getDexQuote/);
  assert.match(server, /token-pairs\/v1/);
  assert.match(server, /scope: 'all'/);
  assert.match(server, /recordNetWorthSnapshot/);
  assert.match(server, /netWorthHistory/);
  assert.match(server, /walletMetadata/);
  assert.match(server, /walletActivityTemplates/);
  assert.match(server, /walletActivityStatuses/);
  assert.match(server, /\/api\/wallets\/bulk-status/);
  assert.match(server, /detectTokenMetadata/);
  assert.match(server, /createKeyedLimiter\(CONCURRENCY_PER_CHAIN\)/);
  assert.match(server, /runScheduledBatch/);
  assert.match(server, /RANDOM_REFRESH_MIN_HOURS = 10/);
  assert.match(server, /RANDOM_REFRESH_MAX_HOURS = 24/);
  assert.match(server, /scheduleNextRandomBatch/);
  assert.match(server, /nextSyncAt/);
  assert.match(server, /addressesForScope/);
  assert.match(server, /getTokenAccountsByOwner/);
  assert.match(server, /0x70a08231/);
  assert.match(server, /request\.method === 'PATCH'.*\/api\\\/tokens/s);
  assert.match(server, /request\.method === 'DELETE'.*\/api\\\/tokens/s);
  assert.match(server, /handleAuthApi/);
  assert.match(server, /handleSetupApi/);
  assert.match(server, /\/api\/setup\/owner/);
  assert.match(server, /registrationMode/);
  assert.match(server, /handleAdminApi/);
  assert.match(server, /requireCsrf/);
  assert.match(client, /applyFontScale/);
  assert.match(client, /chainfolio_font_scale_v1/);
  assert.match(client, /chainfolio_privacy_v1/);
  assert.match(client, /applyPrivacyMode/);
  assert.match(client, /privacyMask/);
  assert.match(client, /privateValue\(money\(group\.value\)\)/);
  assert.match(client, /privateValue\(escapeHtml\(asset\.amount\)\)/);
  assert.match(client, /state\.privacy \? ''/);
  assert.match(client, /导出的 CSV 会包含真实资产净值/);
  assert.match(client, /availableTokenNetworks/);
  assert.match(client, /allocationLegend/);
  assert.match(client, /formatAmount/);
  assert.match(client, /money\(group\.value\)/);
  assert.match(client, /LIST_LIMIT = 20/);
  assert.match(client, /renderListControl/);
  assert.match(client, /selectedComparison/);
  assert.match(client, /renderNetWorthTrend/);
  assert.match(client, /renderPhoneWalletDetails/);
  assert.match(client, /data-phone-wallet-edit/);
  assert.match(client, /sybilStatuses/);
  assert.match(client, /activityValues/);
  assert.match(client, /activityFieldBuilder/);
  assert.match(client, /walletActivityTemplates/);
  assert.match(client, /renderWalletActivityFields/);
  assert.match(client, /renderWalletStats/);
  assert.match(client, /exportWalletStats/);
  assert.match(client, /exportAssets/);
  assert.match(client, /walletLabel\(asset\.wallet, asset\.phoneId\)/);
  assert.match(client, /selectedStatsWallets/);
  assert.match(client, /setActiveView/);
  assert.match(client, /guideAction/);
  assert.match(client, /viewTitles.*guide/s);
  assert.match(client, /matrixHiddenColumns/);
  assert.match(client, /joined/);
  assert.match(client, /暂无报价/);
});
