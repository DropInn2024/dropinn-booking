/**
 * Auth 路由
 * POST /api/drift/login    — 好友 or 主理人登入
 * POST /api/drift/register — 好友自助註冊
 * GET  /api/drift/profile  — 讀取個人資料（需登入）
 * PUT  /api/drift/profile  — 更新個人資料（需登入）
 */

import { createToken } from '../lib/token.js';
import { hashPassword } from '../lib/hash.js';
import { json } from '../lib/utils.js';

export async function handleAuth(request, env, action, user = null) {
  // salt 在 login / register 都需要，先取到函式頂部
  const salt = env.SALT || '';

  switch (action) {

    // ── 登入 ────────────────────────────────────────────────
    case 'login': {
      const { loginId, password } = await request.json();
      if (!loginId || !password) return json({ error: '請填寫帳號與密碼' }, 400);

      // 先試主理人帳號（存在 Worker secrets）
      const adminId   = env.ADMIN_LOGIN_ID;
      const adminHash = env.ADMIN_PASSWORD_HASH;

      if (adminId && loginId === adminId) {
        const hash = await hashPassword(loginId, password, salt);
        if (hash !== adminHash) return json({ error: '帳號或密碼錯誤' }, 401);
        const token = await createToken({ userId: 'owner', role: 'owner', displayName: '主理人' }, env.TOKEN_SECRET);
        return json({ success: true, token, role: 'owner', displayName: '主理人' });
      }

      // 好友帳號（D1）
      const row = await env.DB.prepare(
        'SELECT * FROM drift_users WHERE loginId = ?'
      ).bind(loginId).first();

      if (!row) return json({ error: '帳號或密碼錯誤' }, 401);

      const hash = await hashPassword(loginId, password, salt);
      if (hash !== row.passwordHash) return json({ error: '帳號或密碼錯誤' }, 401);

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

      const passwordHash = await hashPassword(loginId, password, salt);
      const userId = 'U_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const now = new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO drift_users (userId, loginId, passwordHash, displayName, createdAt, lastLogin)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(userId, loginId, passwordHash, displayName, now, now).run();

      const token = await createToken(
        { userId, role: 'friend', displayName },
        env.TOKEN_SECRET
      );
      return json({ success: true, token, role: 'friend', displayName });
    }

    // ── 讀取個人資料 ────────────────────────────────────────
    case 'profile': {
      if (user.role === 'owner') {
        return json({ success: true, userId: 'owner', role: 'owner', displayName: '主理人', persona: '' });
      }
      const row = await env.DB.prepare(
        'SELECT userId, displayName, persona, createdAt FROM drift_users WHERE userId = ?'
      ).bind(user.userId).first();
      if (!row) return json({ error: '找不到使用者' }, 404);
      return json({ success: true, ...row, role: 'friend' });
    }

    // ── 更新個人資料 ────────────────────────────────────────
    case 'updateProfile': {
      if (user.role === 'owner') return json({ error: '主理人資料不可在此修改' }, 403);
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

    default:
      return json({ error: '未知操作' }, 400);
  }
}
