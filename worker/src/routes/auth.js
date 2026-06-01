/**
 * Auth 路由
 * POST /api/drift/login      — 雫編登入（帳號＋密碼）
 * POST /api/drift/code-login — 客人代碼登入（單一 accessCode）
 * POST /api/drift/register   — 好友自助註冊（已停用前端入口，保留 API）
 * GET  /api/drift/profile    — 讀取個人資料（需登入）
 * PUT  /api/drift/profile    — 更新個人資料（需登入）
 */

import { createToken } from '../lib/token.js';
import { verifyPassword, hashPasswordV2 } from '../lib/hash.js';
import { json } from '../lib/utils.js';

export async function handleAuth(request, env, action, user = null) {
  // v1 fallback 用（升級期間保留，所有帳號重設後可移除）
  const legacySalt = env.SALT || '';

  switch (action) {

    // ── 登入 ────────────────────────────────────────────────
    case 'login': {
      const { loginId, password } = await request.json();
      if (!loginId || !password) return json({ error: '請填寫帳號與密碼' }, 400);

      // 先試雫編帳號（存在 Worker secrets，密碼 override 存在 D1）
      const adminId = env.ADMIN_LOGIN_ID;
      if (adminId && loginId === adminId) {
        // D1 override 優先（使用者曾透過 UI 改密碼後存在這裡）
        const override = await env.DB.prepare(
          'SELECT value FROM site_config WHERE key = ?'
        ).bind('admin_password_hash').first();
        const adminHash = override?.value || env.ADMIN_PASSWORD_HASH;
        const ok = await verifyPassword(password, adminHash, loginId, legacySalt);
        if (!ok) return json({ error: '帳號或密碼錯誤' }, 401);
        const token = await createToken({ userId: 'owner', role: 'owner', displayName: '雫編' }, env.TOKEN_SECRET);
        return json({ success: true, token, role: 'owner', displayName: '雫編' });
      }

      // 好友帳號（D1）
      const row = await env.DB.prepare(
        'SELECT * FROM drift_users WHERE loginId = ?'
      ).bind(loginId).first();

      if (!row) return json({ error: '帳號或密碼錯誤' }, 401);

      const ok = await verifyPassword(password, row.passwordHash, loginId, legacySalt);
      if (!ok) return json({ error: '帳號或密碼錯誤' }, 401);

      // 審核狀態檢查
      if (row.approvalStatus === 'pending') {
        return json({ error: '帳號尚未審核，請等待雫編確認。' }, 403);
      }
      if (row.approvalStatus === 'rejected') {
        return json({ error: '帳號申請未通過。' }, 403);
      }

      // 更新最後登入時間
      await env.DB.prepare(
        'UPDATE drift_users SET lastLogin = ? WHERE userId = ?'
      ).bind(new Date().toISOString(), row.userId).run();

      const token = await createToken(
        { userId: row.userId, role: 'friend', displayName: row.displayName },
        env.TOKEN_SECRET
      );
      return json({ success: true, token, role: 'friend', displayName: row.displayName });
    }

    // ── 註冊（好友自助）────────────────────────────────────
    case 'register': {
      const { loginId, password, displayName } = await request.json();

      if (!loginId || !password || !displayName) {
        return json({ error: '請填寫帳號、密碼與顯示名稱' }, 400);
      }
      if (loginId.length < 3) return json({ error: '帳號至少 3 個字元' }, 400);
      if (password.length < 6) return json({ error: '密碼至少 6 個字元' }, 400);
      if (displayName.length > 20) return json({ error: '顯示名稱最多 20 字' }, 400);

      // 檢查重複
      const exists = await env.DB.prepare(
        'SELECT userId FROM drift_users WHERE loginId = ?'
      ).bind(loginId).first();
      if (exists) return json({ error: '此帳號已被使用' }, 409);

      const passwordHash = await hashPasswordV2(password);
      const userId = 'U_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO drift_users (userId, loginId, passwordHash, displayName, approvalStatus, createdAt, lastLogin)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`
      ).bind(userId, loginId, passwordHash, displayName, now, now).run();

      // 申請成功 — 等待雫編審核，不發 token
      return json({ success: true, pending: true, message: '申請已送出，雫編確認後即可登入。' });
    }

    // ── 讀取個人資料 ────────────────────────────────────────
    case 'profile': {
      if (user.role === 'owner') {
        return json({ success: true, userId: 'owner', role: 'owner', displayName: '雫編', persona: '' });
      }
      const row = await env.DB.prepare(
        'SELECT userId, displayName, persona, createdAt FROM drift_users WHERE userId = ?'
      ).bind(user.userId).first();
      if (!row) return json({ error: '找不到使用者' }, 404);
      return json({ success: true, ...row, role: 'friend' });
    }

    // ── 更新個人資料 ────────────────────────────────────────
    case 'updateProfile': {
      if (user.role === 'owner') return json({ error: '雫編資料不可在此修改' }, 403);
      const { displayName, persona } = await request.json();
      if (displayName && displayName.length > 20) return json({ error: '顯示名稱最多 20 字' }, 400);
      if (persona && persona.length > 200) return json({ error: '人設最多 200 字' }, 400);

      await env.DB.prepare(
        `UPDATE drift_users SET
           displayName = COALESCE(NULLIF(?, ''), displayName),
           persona     = COALESCE(?, persona)
         WHERE userId = ?`
      ).bind(displayName || '', persona ?? null, user.userId).run();

      return json({ success: true });
    }

    // ── 客人代碼登入 ────────────────────────────────────────
    case 'codeLogin': {
      const { code } = await request.json();
      if (!code) return json({ error: '請輸入代碼' }, 400);
      const codeTrim = String(code).trim();

      // 今天（台灣 +8）YYYY-MM-DD，用來檢查代碼有效期窗
      const today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

      // 1) 先查 drift_codes 表（可分層 tier、可到期、可個別撤銷）
      const row = await env.DB.prepare(
        `SELECT code, tier, validFrom, validUntil FROM drift_codes
         WHERE code = ? COLLATE NOCASE AND active = 1`
      ).bind(codeTrim).first();

      if (row) {
        if (row.validFrom && today < row.validFrom) return json({ error: '此代碼尚未生效' }, 403);
        if (row.validUntil && today > row.validUntil) return json({ error: '此代碼已過期' }, 403);
        const tier = row.tier === 'premium' ? 'premium' : 'free';
        // 進場次數統計（await 確保寫入完成；非致命）
        await env.DB.prepare(
          `UPDATE drift_codes SET usedCount = usedCount + 1 WHERE code = ?`
        ).bind(row.code).run().catch(() => {});
        const token = await createToken(
          { userId: 'guest', role: 'guest', tier, displayName: '訪客' },
          env.TOKEN_SECRET
        );
        return json({ success: true, token, role: 'guest', tier });
      }

      // 2) 後備：舊的單一 DRIFT_ACCESS_CODE（過渡期保留，視為 free）
      const validCode = env.DRIFT_ACCESS_CODE;
      if (validCode && codeTrim === validCode.trim()) {
        const token = await createToken(
          { userId: 'guest', role: 'guest', tier: 'free', displayName: '訪客' },
          env.TOKEN_SECRET
        );
        return json({ success: true, token, role: 'guest', tier: 'free' });
      }

      return json({ error: '代碼不正確' }, 401);
    }

    // ── 管理員改密碼 ────────────────────────────────────────
    case 'changePassword': {
      if (!user || user.role !== 'owner') return json({ error: '權限不足' }, 403);

      const { currentPassword, newPassword } = await request.json().catch(() => ({}));
      if (!currentPassword || !newPassword) return json({ error: '請填寫目前密碼與新密碼' }, 400);
      if (String(newPassword).length < 6) return json({ error: '新密碼至少 6 個字元' }, 400);

      // 驗證目前密碼（D1 override 優先）
      const override = await env.DB.prepare(
        'SELECT value FROM site_config WHERE key = ?'
      ).bind('admin_password_hash').first();
      const currentHash = override?.value || env.ADMIN_PASSWORD_HASH;
      const adminId = env.ADMIN_LOGIN_ID;

      const ok = await verifyPassword(currentPassword, currentHash, adminId, legacySalt);
      if (!ok) return json({ error: '目前密碼不正確' }, 401);

      // 產生新 hash 存入 D1
      const newHash = await hashPasswordV2(String(newPassword));
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT OR REPLACE INTO site_config (key, value, updatedAt) VALUES (?, ?, ?)'
      ).bind('admin_password_hash', newHash, now).run();

      return json({ success: true });
    }

    default:
      return json({ error: '未知操作' }, 400);
  }
}
