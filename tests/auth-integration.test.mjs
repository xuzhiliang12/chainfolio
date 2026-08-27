import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/healthz`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
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

test('supports first-run owner setup, optional invite registration, isolated portfolios, and CSRF protection', async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), 'chainfolio-auth-'));
  const port = 44000 + (process.pid % 1000);
  const url = `http://127.0.0.1:${port}`;
  const adminPassword = 'AdminPassword-123';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATA_ROOT: dataRoot,
      COOKIE_SECURE: 'false'
    },
    stdio: 'ignore'
  });

  try {
    await waitForServer(url);

    const setupStatus = await request(url, '/api/setup/status');
    assert.equal(setupStatus.response.status, 200);
    assert.equal(setupStatus.payload.needsSetup, true);
    assert.equal(setupStatus.payload.registrationMode, 'disabled');

    const ownerSetup = await request(url, '/api/setup/owner', { method: 'POST', body: { username: 'chainfolio', password: adminPassword } });
    assert.equal(ownerSetup.response.status, 201);
    assert.equal(ownerSetup.payload.user.role, 'admin');
    const adminCookie = ownerSetup.cookie;
    const adminCsrf = ownerSetup.payload.csrfToken;

    const repeatedSetup = await request(url, '/api/setup/owner', { method: 'POST', body: { username: 'other-owner', password: 'OtherPassword-123' } });
    assert.equal(repeatedSetup.response.status, 409);

    const adminStateBefore = await request(url, '/api/state', { cookie: adminCookie });
    assert.equal(adminStateBefore.response.status, 200);
    assert.equal(adminStateBefore.payload.managers.length, 0);

    const registrationDisabled = await request(url, '/api/auth/register', { method: 'POST', body: { inviteCode: 'CF-NOT-ENABLED', username: 'blocked-user', password: 'UserPassword-123' } });
    assert.equal(registrationDisabled.response.status, 403);

    const enableRegistration = await request(url, '/api/admin/settings', { method: 'PATCH', body: { registrationMode: 'invite' }, cookie: adminCookie, csrf: adminCsrf });
    assert.equal(enableRegistration.response.status, 200);
    assert.equal(enableRegistration.payload.settings.registrationMode, 'invite');

    const invite = await request(url, '/api/admin/invites', { method: 'POST', body: { label: '测试用户' }, cookie: adminCookie, csrf: adminCsrf });
    assert.equal(invite.response.status, 201);
    assert.match(invite.payload.invite.code, /^CF-/);

    const registration = await request(url, '/api/auth/register', { method: 'POST', body: { inviteCode: invite.payload.invite.code, username: 'test-user', password: 'UserPassword-123' } });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.payload.user.role, 'user');
    const userCookie = registration.cookie;
    const userCsrf = registration.payload.csrfToken;

    const userState = await request(url, '/api/state', { cookie: userCookie });
    assert.equal(userState.payload.managers.length, 0);
    assert.equal(userState.payload.addresses.length, 0);

    const reusedInvite = await request(url, '/api/auth/register', { method: 'POST', body: { inviteCode: invite.payload.invite.code, username: 'second-user', password: 'UserPassword-456' } });
    assert.equal(reusedInvite.response.status, 400);

    const missingCsrf = await request(url, '/api/managers', { method: 'POST', body: { name: '不应创建' }, cookie: userCookie });
    assert.equal(missingCsrf.response.status, 403);

    const createManager = await request(url, '/api/managers', { method: 'POST', body: { name: '用户管理人' }, cookie: userCookie, csrf: userCsrf });
    assert.equal(createManager.response.status, 200);
    assert.equal(createManager.payload.managers.length, 1);
    const managerId = createManager.payload.managers[0].id;
    const createPhone = await request(url, '/api/phones', { method: 'POST', body: { name: '钱包测试手机', managerId }, cookie: userCookie, csrf: userCsrf });
    assert.equal(createPhone.response.status, 200);
    const phoneId = createPhone.payload.phones[0].id;
    const createActivity = await request(url, '/api/wallet-activities', { method: 'POST', body: { name: '测试活动' }, cookie: userCookie, csrf: userCsrf });
    assert.equal(createActivity.response.status, 200);
    const activityId = createActivity.payload.walletActivityTemplates[0].id;
    const walletProfile = await request(url, `/api/phones/${phoneId}/wallets/2`, { method: 'PATCH', body: { name: '测试钱包', createdAt: '2026-08-01T09:30', sybilStatus: 'suspected', note: '同批创建，人工复核', activityStatuses: { [activityId]: 'completed' } }, cookie: userCookie, csrf: userCsrf });
    assert.equal(walletProfile.response.status, 200);
    assert.equal(walletProfile.payload.walletMetadata[`${phoneId}:2`].createdAt, '2026-08-01T09:30');
    assert.equal(walletProfile.payload.walletMetadata[`${phoneId}:2`].sybilStatus, 'suspected');
    assert.equal(walletProfile.payload.walletMetadata[`${phoneId}:2`].note, '同批创建，人工复核');
    assert.equal(walletProfile.payload.walletActivityStatuses[`${phoneId}:2`][activityId].status, 'completed');
    const bulkStatus = await request(url, '/api/wallets/bulk-status', { method: 'POST', body: { walletKeys: [`${phoneId}:2`], field: 'sybilStatus', value: 'pending' }, cookie: userCookie, csrf: userCsrf });
    assert.equal(bulkStatus.response.status, 200);
    assert.equal(bulkStatus.payload.walletMetadata[`${phoneId}:2`].sybilStatus, 'pending');
    const archiveActivity = await request(url, `/api/wallet-activities/${activityId}`, { method: 'PATCH', body: { archived: true }, cookie: userCookie, csrf: userCsrf });
    assert.equal(archiveActivity.response.status, 200);
    assert.equal(archiveActivity.payload.walletActivityTemplates[0].archived, true);
    const deleteFirstWallet = await request(url, `/api/phones/${phoneId}/wallets/1`, { method: 'DELETE', cookie: userCookie, csrf: userCsrf });
    assert.equal(deleteFirstWallet.response.status, 200);
    assert.equal(deleteFirstWallet.payload.walletNames[`${phoneId}:1`], '测试钱包');
    assert.equal(deleteFirstWallet.payload.walletMetadata[`${phoneId}:1`].sybilStatus, 'pending');
    assert.equal(deleteFirstWallet.payload.walletActivityStatuses[`${phoneId}:1`][activityId].status, 'completed');
    assert.equal(deleteFirstWallet.payload.walletMetadata[`${phoneId}:2`], undefined);
    const deleteActivity = await request(url, `/api/wallet-activities/${activityId}`, { method: 'DELETE', cookie: userCookie, csrf: userCsrf });
    assert.equal(deleteActivity.response.status, 200);
    assert.equal(deleteActivity.payload.walletActivityTemplates.length, 0);
    assert.equal(deleteActivity.payload.walletActivityStatuses[`${phoneId}:1`], undefined);

    const forbiddenAdmin = await request(url, '/api/admin/users', { cookie: userCookie });
    assert.equal(forbiddenAdmin.response.status, 403);

    const adminStateAfter = await request(url, '/api/state', { cookie: adminCookie });
    assert.equal(adminStateAfter.payload.managers.length, 0);
  } finally {
    child.kill();
    await new Promise(resolve => setTimeout(resolve, 250));
    await rm(dataRoot, { recursive: true, force: true });
  }
});
