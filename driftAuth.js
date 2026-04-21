/**
 * driftAuth.js
 * Drift 旅遊指南功能的使用者認證與評論模組
 *
 * ── 角色說明 ─────────────────────────────────────────
 * owner  — 與 notforyou 後台同一組帳密（ADMIN_LOGIN_ID / ADMIN_PASSWORD_HASH）
 *           顯示名稱「雫旅」，不存放於 DriftUsers 工作表
 * friend — 自行註冊，存於 DriftUsers 工作表
 * guest  — 未登入訪客（純前端狀態，本模組無對應函式）
 *
 * ── 工作表結構 ───────────────────────────────────────
 * DriftUsers   : user_id, role, account, password_hash, nickname, persona, created_at
 * DriftReviews : review_id, spot_id, user_id, nickname_snapshot, note, created_at, updated_at
 *
 * ── Token 格式（30 天有效）────────────────────────────
 * raw = "{userId}|{role}|{ts}"
 * sig = base64(SHA-256(raw + "::" + DRIFT_TOKEN_SECRET))
 * token = base64WebSafe("{userId}|{role}|{ts}|{sig}")
 *
 * ── 依賴 ─────────────────────────────────────────────
 * config.gs   — Config.SHEET_ID
 * main.js     — hashPassword_(loginId, password, salt)
 */

// ─────────────────────────────────────────────────────
// 內部常數
// ─────────────────────────────────────────────────────
var DRIFT_USERS_SHEET_NAME_    = 'DriftUsers';
var DRIFT_REVIEWS_SHEET_NAME_  = 'DriftReviews';
var DRIFT_TOKEN_MAX_AGE_MS_    = 30 * 24 * 60 * 60 * 1000; // 30 天
var DRIFT_REVIEWS_CACHE_TTL_   = 120; // 秒
var DRIFT_OWNER_NICKNAME_      = '雫旅';

// ─────────────────────────────────────────────────────
// 內部工具：Token
// ─────────────────────────────────────────────────────

/**
 * 取得 Drift Token 密鑰（PropertiesService 或 fallback dev secret）
 * @returns {string}
 */
function getDriftTokenSecret_() {
  return PropertiesService.getScriptProperties().getProperty('DRIFT_TOKEN_SECRET') || 'drift_dev_secret';
}

/**
 * 產生 30 天 Drift Token
 * @param {string} userId
 * @param {string} role  'owner' | 'friend'
 * @returns {string}
 */
function getDriftToken_(userId, role) {
  const ts  = Date.now();
  const raw = userId + '|' + role + '|' + ts;
  const sig = Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      raw + '::' + getDriftTokenSecret_()
    )
  );
  return Utilities.base64EncodeWebSafe(raw + '|' + sig);
}

/**
 * 驗證 Drift Token
 * @param {string} token
 * @returns {{ userId: string, role: string }|null}
 */
function verifyDriftToken_(token) {
  if (!token) return null;
  try {
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
    const parts   = decoded.split('|');
    if (parts.length !== 4) return null;

    const userId = parts[0];
    const role   = parts[1];
    const ts     = Number(parts[2]);
    const sig    = parts[3];

    if (isNaN(ts)) return null;
    if (Date.now() - ts > DRIFT_TOKEN_MAX_AGE_MS_) return null;

    const raw      = userId + '|' + role + '|' + ts;
    const expected = Utilities.base64Encode(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        raw + '::' + getDriftTokenSecret_()
      )
    );
    if (expected !== sig) return null;

    return { userId: userId, role: role };
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────
// 內部工具：工作表取得（不存在則建立）
// ─────────────────────────────────────────────────────

/**
 * 取得 DriftUsers 與 DriftReviews 工作表，若不存在則建立（含標題列）
 * @returns {{ users: GoogleAppsScript.Spreadsheet.Sheet, reviews: GoogleAppsScript.Spreadsheet.Sheet }}
 */
function getDriftSheets_() {
  const ss = SpreadsheetApp.openById(Config.SHEET_ID);

  let users = ss.getSheetByName(DRIFT_USERS_SHEET_NAME_);
  if (!users) {
    users = ss.insertSheet(DRIFT_USERS_SHEET_NAME_);
    users.appendRow(['user_id', 'role', 'account', 'password_hash', 'nickname', 'persona', 'created_at']);
    users.setFrozenRows(1);
    Logger.log('✅ 建立工作表：' + DRIFT_USERS_SHEET_NAME_);
  }

  let reviews = ss.getSheetByName(DRIFT_REVIEWS_SHEET_NAME_);
  if (!reviews) {
    reviews = ss.insertSheet(DRIFT_REVIEWS_SHEET_NAME_);
    reviews.appendRow(['review_id', 'spot_id', 'user_id', 'nickname_snapshot', 'note', 'created_at', 'updated_at']);
    reviews.setFrozenRows(1);
    Logger.log('✅ 建立工作表：' + DRIFT_REVIEWS_SHEET_NAME_);
  }

  return { users: users, reviews: reviews };
}

// ─────────────────────────────────────────────────────
// 初始化：setupDriftAuthSheets
// ─────────────────────────────────────────────────────

/**
 * 建立 DriftUsers + DriftReviews 工作表（含欄寬設定與凍結標題列）
 * 可在 GAS 編輯器手動執行一次。
 */
function setupDriftAuthSheets() {
  const ss = SpreadsheetApp.openById(Config.SHEET_ID);

  // ── DriftUsers ──
  let users = ss.getSheetByName(DRIFT_USERS_SHEET_NAME_);
  if (!users) {
    users = ss.insertSheet(DRIFT_USERS_SHEET_NAME_);
    Logger.log('✅ 建立「' + DRIFT_USERS_SHEET_NAME_ + '」工作表');
  } else {
    Logger.log('ℹ️ 工作表已存在：' + DRIFT_USERS_SHEET_NAME_);
  }

  const userHeaders = ['user_id', 'role', 'account', 'password_hash', 'nickname', 'persona', 'created_at'];
  users.clearContents();
  const uHeader = users.getRange(1, 1, 1, userHeaders.length);
  uHeader.setValues([userHeaders]);
  uHeader.setFontWeight('bold');
  uHeader.setBackground('#ece8e1');
  uHeader.setFontColor('#1a1210');
  users.setFrozenRows(1);

  users.setColumnWidth(1, 140);  // user_id
  users.setColumnWidth(2, 70);   // role
  users.setColumnWidth(3, 140);  // account
  users.setColumnWidth(4, 240);  // password_hash
  users.setColumnWidth(5, 120);  // nickname
  users.setColumnWidth(6, 280);  // persona
  users.setColumnWidth(7, 160);  // created_at

  // ── DriftReviews ──
  let reviews = ss.getSheetByName(DRIFT_REVIEWS_SHEET_NAME_);
  if (!reviews) {
    reviews = ss.insertSheet(DRIFT_REVIEWS_SHEET_NAME_);
    Logger.log('✅ 建立「' + DRIFT_REVIEWS_SHEET_NAME_ + '」工作表');
  } else {
    Logger.log('ℹ️ 工作表已存在：' + DRIFT_REVIEWS_SHEET_NAME_);
  }

  const reviewHeaders = ['review_id', 'spot_id', 'user_id', 'nickname_snapshot', 'note', 'created_at', 'updated_at'];
  reviews.clearContents();
  const rHeader = reviews.getRange(1, 1, 1, reviewHeaders.length);
  rHeader.setValues([reviewHeaders]);
  rHeader.setFontWeight('bold');
  rHeader.setBackground('#ece8e1');
  rHeader.setFontColor('#1a1210');
  reviews.setFrozenRows(1);

  reviews.setColumnWidth(1, 180);  // review_id
  reviews.setColumnWidth(2, 80);   // spot_id
  reviews.setColumnWidth(3, 140);  // user_id
  reviews.setColumnWidth(4, 120);  // nickname_snapshot
  reviews.setColumnWidth(5, 360);  // note
  reviews.setColumnWidth(6, 160);  // created_at
  reviews.setColumnWidth(7, 160);  // updated_at

  Logger.log('✅ setupDriftAuthSheets 完成');
  return '設定完成！請到 Google Sheets 查看工作表。';
}

// ─────────────────────────────────────────────────────
// driftLogin_
// ─────────────────────────────────────────────────────

/**
 * Drift 登入
 * @param {{ account: string, password: string }} data
 * @returns {{ success: boolean, token?: string, role?: string, nickname?: string, message?: string }}
 */
function driftLogin_(data) {
  try {
    const account  = String(data.account  || '').trim();
    const password = String(data.password || '');

    if (!account || !password) {
      return { success: false, message: '請填寫帳號與密碼' };
    }

    const props = PropertiesService.getScriptProperties();
    const salt   = props.getProperty('AGENCY_SALT') || 'dev_salt';

    // ── 嘗試 owner 登入 ──
    const adminLoginId    = (props.getProperty('ADMIN_LOGIN_ID') || '').trim();
    const adminPassHash   = (props.getProperty('ADMIN_PASSWORD_HASH') || '').trim();

    if (adminLoginId && account === adminLoginId) {
      const hash = hashPassword_(account, password, salt);
      if (hash === adminPassHash) {
        const token = getDriftToken_('owner', 'owner');
        Logger.log('✅ Drift owner 登入成功');
        return { success: true, token: token, role: 'owner', nickname: DRIFT_OWNER_NICKNAME_ };
      }
      // 帳號對但密碼錯，直接回錯誤（不繼續查 DriftUsers）
      return { success: false, message: '帳號或密碼錯誤' };
    }

    // ── 嘗試 friend 登入 ──
    const { users } = getDriftSheets_();
    const lastRow = users.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    const rows    = users.getRange(2, 1, lastRow - 1, 7).getValues();
    const headers = ['user_id', 'role', 'account', 'password_hash', 'nickname', 'persona', 'created_at'];
    const iMap    = {};
    headers.forEach((h, i) => { iMap[h] = i; });

    const hash = hashPassword_(account, password, salt);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (String(row[iMap['account']]).trim() === account &&
          String(row[iMap['password_hash']]).trim() === hash) {
        const userId   = String(row[iMap['user_id']]);
        const nickname = String(row[iMap['nickname']]);
        const token    = getDriftToken_(userId, 'friend');
        Logger.log('✅ Drift friend 登入成功：' + userId);
        return { success: true, token: token, role: 'friend', nickname: nickname };
      }
    }

    return { success: false, message: '帳號或密碼錯誤' };

  } catch (e) {
    Logger.log('❌ driftLogin_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// driftRegister_
// ─────────────────────────────────────────────────────

/**
 * Drift 朋友帳號註冊
 * @param {{ account: string, nickname: string, password: string }} data
 * @returns {{ success: boolean, message?: string }}
 */
function driftRegister_(data) {
  try {
    const account  = String(data.account  || '').trim();
    const nickname = String(data.nickname || '').trim();
    const password = String(data.password || '');

    // 格式驗證
    if (!/^[A-Za-z0-9_]{4,20}$/.test(account)) {
      return { success: false, message: '帳號需為 4–20 位英數字或底線' };
    }
    if (nickname.length < 2 || nickname.length > 16) {
      return { success: false, message: '暱稱需為 2–16 個字元' };
    }
    if (password.length < 6) {
      return { success: false, message: '密碼至少需要 6 個字元' };
    }

    const { users } = getDriftSheets_();
    const lastRow   = users.getLastRow();

    // 帳號重複檢查
    if (lastRow >= 2) {
      const accountCol = users.getRange(2, 3, lastRow - 1, 1).getValues();
      for (let i = 0; i < accountCol.length; i++) {
        if (String(accountCol[i][0]).trim() === account) {
          return { success: false, message: '此帳號已被使用' };
        }
      }
    }

    // 與 owner 帳號重複檢查
    const adminLoginId = (PropertiesService.getScriptProperties().getProperty('ADMIN_LOGIN_ID') || '').trim();
    if (adminLoginId && account === adminLoginId) {
      return { success: false, message: '此帳號已被使用' };
    }

    const props    = PropertiesService.getScriptProperties();
    const salt     = props.getProperty('AGENCY_SALT') || 'dev_salt';
    const hash     = hashPassword_(account, password, salt);
    const userId   = 'u' + Date.now();
    const now      = new Date().toISOString();

    users.appendRow([userId, 'friend', account, hash, nickname, '', now]);
    Logger.log('✅ Drift 新用戶註冊：' + userId + ' / ' + account);

    return { success: true };

  } catch (e) {
    Logger.log('❌ driftRegister_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// driftGetProfile_
// ─────────────────────────────────────────────────────

/**
 * 取得目前登入用戶的個人資料
 * @param {{ token: string }} data
 * @returns {{ success: boolean, userId?: string, role?: string, nickname?: string, persona?: string }}
 */
function driftGetProfile_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified) {
      return { success: false, message: 'Token 無效或已過期' };
    }

    const { userId, role } = verified;

    // owner 固定資料
    if (role === 'owner') {
      const ownerPersona = PropertiesService.getScriptProperties().getProperty('DRIFT_OWNER_PERSONA') || '';
      return {
        success: true,
        userId: 'owner',
        role: 'owner',
        nickname: DRIFT_OWNER_NICKNAME_,
        persona: ownerPersona,
      };
    }

    // friend：從 DriftUsers 讀取
    const { users } = getDriftSheets_();
    const lastRow   = users.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: '找不到使用者' };
    }

    const rows = users.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === userId) {
        return {
          success:  true,
          userId:   String(rows[i][0]),
          role:     String(rows[i][1]),
          nickname: String(rows[i][4]),
          persona:  String(rows[i][5]),
        };
      }
    }

    return { success: false, message: '找不到使用者' };

  } catch (e) {
    Logger.log('❌ driftGetProfile_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// driftUpdateProfile_
// ─────────────────────────────────────────────────────

/**
 * 更新個人資料（暱稱 / persona）
 * @param {{ token: string, nickname?: string, persona?: string }} data
 * @returns {{ success: boolean }}
 */
function driftUpdateProfile_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified) {
      return { success: false, message: 'Token 無效或已過期' };
    }

    const { userId, role } = verified;
    const persona  = data.persona  !== undefined ? String(data.persona)  : null;
    const nickname = data.nickname !== undefined ? String(data.nickname) : null;

    // owner：persona 存到 PropertiesService，nickname 固定不更新
    if (role === 'owner') {
      if (persona !== null) {
        PropertiesService.getScriptProperties().setProperty('DRIFT_OWNER_PERSONA', persona);
        Logger.log('✅ Drift owner persona 已更新');
      }
      return { success: true };
    }

    // friend：更新 DriftUsers 對應列
    const { users } = getDriftSheets_();
    const lastRow   = users.getLastRow();
    if (lastRow < 2) {
      return { success: false, message: '找不到使用者' };
    }

    const rows = users.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === userId) {
        const sheetRow = i + 2; // 1-indexed，+1 標題
        if (nickname !== null) {
          users.getRange(sheetRow, 5).setValue(nickname); // col 5: nickname
        }
        if (persona !== null) {
          users.getRange(sheetRow, 6).setValue(persona);  // col 6: persona
        }
        Logger.log('✅ Drift 用戶資料更新：' + userId);
        return { success: true };
      }
    }

    return { success: false, message: '找不到使用者' };

  } catch (e) {
    Logger.log('❌ driftUpdateProfile_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// getDriftReviews_
// ─────────────────────────────────────────────────────

/**
 * 取得指定景點的所有評論（不需登入）
 * 快取 2 分鐘，key = drift_reviews_v1_{spotId}
 * @param {string} spotId
 * @returns {{ success: boolean, reviews?: Array }}
 */
function getDriftReviews_(spotId) {
  try {
    if (!spotId) {
      return { success: false, message: '請提供 spotId' };
    }

    const cacheKey = 'drift_reviews_v1_' + spotId;
    const cache    = CacheService.getScriptCache();
    const cached   = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { users, reviews } = getDriftSheets_();

    // 建立 userId -> { nickname, persona } 對照表
    const userMap = {};
    const uLast   = users.getLastRow();
    if (uLast >= 2) {
      const uRows = users.getRange(2, 1, uLast - 1, 7).getValues();
      uRows.forEach(function(row) {
        const uid = String(row[0]);
        userMap[uid] = {
          nickname: String(row[4]),
          persona:  String(row[5]),
        };
      });
    }

    // 取得 owner persona
    const ownerPersona = PropertiesService.getScriptProperties().getProperty('DRIFT_OWNER_PERSONA') || '';

    const rLast = reviews.getLastRow();
    if (rLast < 2) {
      const empty = { success: true, reviews: [] };
      cache.put(cacheKey, JSON.stringify(empty), DRIFT_REVIEWS_CACHE_TTL_);
      return empty;
    }

    const rRows  = reviews.getRange(2, 1, rLast - 1, 7).getValues();
    // cols: review_id[0], spot_id[1], user_id[2], nickname_snapshot[3], note[4], created_at[5], updated_at[6]

    const result = rRows
      .filter(function(row) {
        return String(row[1]).trim() === String(spotId).trim() && String(row[0]).trim() !== '';
      })
      .map(function(row) {
        const reviewId       = String(row[0]);
        const uid            = String(row[2]);
        const nicknameSnap   = String(row[3]);
        const note           = String(row[4]);
        const createdAt      = row[5] ? new Date(row[5]).toISOString() : '';

        let author, persona, isOwner;

        if (uid === 'owner') {
          author  = DRIFT_OWNER_NICKNAME_;
          persona = ownerPersona;
          isOwner = true;
        } else if (userMap[uid]) {
          author  = userMap[uid].nickname || nicknameSnap || uid;
          persona = userMap[uid].persona;
          isOwner = false;
        } else {
          // 用戶已刪除，使用快照
          author  = nicknameSnap || uid;
          persona = '';
          isOwner = false;
        }

        return {
          review_id:  reviewId,
          author:     author,
          persona:    persona,
          note:       note,
          created_at: createdAt,
          isOwner:    isOwner,
        };
      })
      .sort(function(a, b) {
        return (a.created_at < b.created_at) ? -1 : (a.created_at > b.created_at) ? 1 : 0;
      });

    const output = { success: true, reviews: result };
    cache.put(cacheKey, JSON.stringify(output), DRIFT_REVIEWS_CACHE_TTL_);
    return output;

  } catch (e) {
    Logger.log('❌ getDriftReviews_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// saveDriftReview_
// ─────────────────────────────────────────────────────

/**
 * 新增或更新景點評論（upsert by spot_id + user_id）
 * @param {{ token: string, spotId: string, note: string }} data
 * @returns {{ success: boolean }}
 */
function saveDriftReview_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified) {
      return { success: false, message: 'Token 無效或已過期' };
    }

    const spotId = String(data.spotId || '').trim();
    const note   = String(data.note   || '').trim();

    if (!spotId) {
      return { success: false, message: '請提供 spotId' };
    }

    const { userId, role } = verified;
    const { users, reviews } = getDriftSheets_();

    // 取得 nickname snapshot
    let nicknameSnapshot = DRIFT_OWNER_NICKNAME_;
    if (role !== 'owner') {
      const uLast = users.getLastRow();
      if (uLast >= 2) {
        const uRows = users.getRange(2, 1, uLast - 1, 6).getValues();
        for (let i = 0; i < uRows.length; i++) {
          if (String(uRows[i][0]) === userId) {
            nicknameSnapshot = String(uRows[i][4]);
            break;
          }
        }
      }
    }

    const now    = new Date().toISOString();
    const rLast  = reviews.getLastRow();

    // Upsert：尋找已有的 (spot_id, user_id) 列
    if (rLast >= 2) {
      const rRows = reviews.getRange(2, 1, rLast - 1, 7).getValues();
      for (let i = 0; i < rRows.length; i++) {
        const rowSpotId = String(rRows[i][1]).trim();
        const rowUserId = String(rRows[i][2]).trim();
        if (rowSpotId === spotId && rowUserId === userId) {
          const sheetRow = i + 2;
          reviews.getRange(sheetRow, 5).setValue(note); // col 5: note
          reviews.getRange(sheetRow, 7).setValue(now);  // col 7: updated_at
          Logger.log('✅ Drift 評論更新：' + userId + ' / ' + spotId);
          // 清除快取
          CacheService.getScriptCache().remove('drift_reviews_v1_' + spotId);
          return { success: true };
        }
      }
    }

    // 新增
    const reviewId = 'r' + Date.now() + Math.floor(Math.random() * 1000);
    reviews.appendRow([reviewId, spotId, userId, nicknameSnapshot, note, now, now]);
    Logger.log('✅ Drift 評論新增：' + reviewId + ' / ' + userId + ' / ' + spotId);
    CacheService.getScriptCache().remove('drift_reviews_v1_' + spotId);

    return { success: true };

  } catch (e) {
    Logger.log('❌ saveDriftReview_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// deleteDriftReview_
// ─────────────────────────────────────────────────────

/**
 * 刪除評論（owner 可刪任何人；friend 只能刪自己）
 * @param {{ token: string, reviewId: string }} data
 * @returns {{ success: boolean }}
 */
function deleteDriftReview_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified) {
      return { success: false, message: 'Token 無效或已過期' };
    }

    const reviewId = String(data.reviewId || '').trim();
    if (!reviewId) {
      return { success: false, message: '請提供 reviewId' };
    }

    const { userId, role } = verified;
    const { reviews } = getDriftSheets_();
    const rLast = reviews.getLastRow();

    if (rLast < 2) {
      return { success: false, message: '找不到評論' };
    }

    const rRows = reviews.getRange(2, 1, rLast - 1, 7).getValues();
    for (let i = 0; i < rRows.length; i++) {
      if (String(rRows[i][0]).trim() === reviewId) {
        const rowUserId = String(rRows[i][2]).trim();
        const spotId    = String(rRows[i][1]).trim();

        // 權限檢查
        if (role !== 'owner' && rowUserId !== userId) {
          return { success: false, message: '無權限刪除此評論' };
        }

        reviews.deleteRow(i + 2); // 1-indexed + 標題
        Logger.log('✅ Drift 評論刪除：' + reviewId + '（操作者：' + userId + '）');
        CacheService.getScriptCache().remove('drift_reviews_v1_' + spotId);
        return { success: true };
      }
    }

    return { success: false, message: '找不到評論' };

  } catch (e) {
    Logger.log('❌ deleteDriftReview_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// getDriftUsers_
// ─────────────────────────────────────────────────────

/**
 * 取得所有 DriftUsers（owner 專用，不含 password_hash）
 * @param {{ token: string }} data
 * @returns {{ success: boolean, users?: Array }}
 */
function getDriftUsers_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified || verified.role !== 'owner') {
      return { success: false, message: '需要 owner 權限' };
    }

    const { users } = getDriftSheets_();
    const lastRow   = users.getLastRow();

    if (lastRow < 2) {
      return { success: true, users: [] };
    }

    const rows   = users.getRange(2, 1, lastRow - 1, 7).getValues();
    const result = rows
      .filter(function(row) { return String(row[0]).trim() !== ''; })
      .map(function(row) {
        return {
          user_id:    String(row[0]),
          role:       String(row[1]),
          account:    String(row[2]),
          // password_hash (col 3) 不回傳
          nickname:   String(row[4]),
          persona:    String(row[5]),
          created_at: row[6] ? new Date(row[6]).toISOString() : '',
        };
      });

    return { success: true, users: result };

  } catch (e) {
    Logger.log('❌ getDriftUsers_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────
// deleteDriftUser_
// ─────────────────────────────────────────────────────

/**
 * 刪除 DriftUsers 中的用戶（owner 專用）
 * @param {{ token: string, userId: string }} data
 * @returns {{ success: boolean }}
 */
function deleteDriftUser_(data) {
  try {
    const verified = verifyDriftToken_(data.token);
    if (!verified || verified.role !== 'owner') {
      return { success: false, message: '需要 owner 權限' };
    }

    const targetId = String(data.userId || '').trim();
    if (!targetId) {
      return { success: false, message: '請提供 userId' };
    }
    if (targetId === 'owner') {
      return { success: false, message: '無法刪除 owner' };
    }

    const { users } = getDriftSheets_();
    const lastRow   = users.getLastRow();

    if (lastRow < 2) {
      return { success: false, message: '找不到使用者' };
    }

    const rows = users.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === targetId) {
        users.deleteRow(i + 2);
        Logger.log('✅ Drift 用戶刪除：' + targetId);
        return { success: true };
      }
    }

    return { success: false, message: '找不到使用者' };

  } catch (e) {
    Logger.log('❌ deleteDriftUser_ 錯誤：' + e.message);
    return { success: false, error: e.message };
  }
}
