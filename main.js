/**
 * main.js
 * 雫旅 DROP INN API 主要入口 (Controller Layer)
 * ✅ 支援：訂房、Admin 後台、房務介面
 * ✅ 新增：updateOrderAndSync API
 * ✅ 新增：getBookedDates API（公開日曆查詢）
 * ✅ 新增：日曆管理 API（rebuildCalendars, clearCalendars, cleanupOldYear）
 */

/**
 * 判斷是否為需 Admin 權限的 action
 * （若之後有新增後台專用 API，請記得一併加進來）
 */
function isAdminAction(action) {
  const adminActions = [
    'getAllOrders', // 取得所有訂單（含房務頁），須驗證 Admin 金鑰
    'getOrderByID',
    'updateOrder',
    'updateOrderAndSync',
    'markCompletedOrders',
    'generateNotification',
    'sendNotificationEmail',
    'rebuildCalendars',
    'clearCalendars',
    'cleanupOldYear',
    'getFinanceStats',
    'getDetailedFinanceReport',
    'getCostForOrder',
    'getCoupons',
    'saveCoupon',
    // 靜態 admin/housekeeping 在 Cloudflare 下用 fetch 呼叫時需要
    'adminRunSetupSystem',
    'adminInitializeYearSheet',
    'adminQuickCheck',
    'getRecommendationRecords',
    'addRecommendationRecord',
    'adminGetSettings',
    'adminSetSettings',
    'getCalendarStats',
    'adminGetAllAgencyData',
    'agencyApprove',
    'agencyReject',
    'agencyDelete',
    'agencyGetPendingList',
    'agencySetVisiblePartners',
    'agencyGroupList',
    'agencyGroupCreate',
    'agencyGroupAddMember',
    'agencyGroupRemoveMember',
    'getMonthlyExpense',
    'saveMonthlyExpense',
  ];
  return adminActions.indexOf(action) !== -1;
}

/** 後台可編輯的 Script Properties 白名單與中文標籤 */
var SETTINGS_WHITELIST = [
  { key: 'SHEET_ID', label: '試算表 ID', isSecret: false },
  { key: 'PUBLIC_CALENDAR_ID', label: '公開日曆 ID', isSecret: false },
  { key: 'HOUSEKEEPING_CALENDAR_ID', label: '房務日曆 ID', isSecret: false },
  { key: 'ADMIN_EMAIL', label: '管理員 Email（提醒信收件）', isSecret: false },
  { key: 'RECAPTCHA_SECRET', label: 'reCAPTCHA 密鑰', isSecret: true },
  { key: 'ADMIN_API_KEY', label: '後台 API 金鑰', isSecret: true },
  { key: 'HOUSEKEEPING_KEY', label: '房務頁密鑰', isSecret: true },
  { key: 'ADMIN_LOGIN_ID', label: '後台登入帳號', isSecret: false },
  { key: 'ADMIN_PASSWORD_HASH', label: '後台密碼 Hash', isSecret: true },
  { key: 'AGENCY_SALT', label: '同業密碼 Salt（進階）', isSecret: true },
  { key: 'AGENCY_TOKEN_SECRET', label: '同業 Token 密鑰（進階）', isSecret: true },
];

/**
 * 檢查 Admin 金鑰是否有效
 *
 * 行為說明：
 * - 如果 Script Properties **沒有** 設定 ADMIN_API_KEY → 視為「未啟用金鑰檢查」，一律通過（維持舊行為）
 * - 如果有設定 ADMIN_API_KEY → 僅當傳入的 adminKey 相同時才通過
 */
function isValidAdminKey(adminKey) {
  if (!adminKey) return false;
  if (verifyAdminToken_(adminKey)) return true;
  var configuredKey = Config.ADMIN_API_KEY;
  return !!configuredKey && adminKey === configuredKey;
}

// ================================
// 同業（日曆）用共用工具
// ================================
function getAgencyConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    SALT: props.getProperty('AGENCY_SALT') || 'dev_salt',
    TOKEN_SECRET: props.getProperty('AGENCY_TOKEN_SECRET') || 'dev_token_secret',
  };
}

function getAdminAuthConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    loginId: (props.getProperty('ADMIN_LOGIN_ID') || '').trim(),
    passwordHash: (props.getProperty('ADMIN_PASSWORD_HASH') || '').trim(),
    salt: props.getProperty('AGENCY_SALT') || 'dev_salt',
  };
}

/**
 * 後台帳密設定工具（僅供 GAS 編輯器手動執行）
 * 用法：
 * setAdminCredentialsForSetup_('你的帳號', '你的新密碼')
 *
 * 行為：
 * - 依 AGENCY_SALT 產生 ADMIN_PASSWORD_HASH
 * - 寫入 Script Properties：ADMIN_LOGIN_ID / ADMIN_PASSWORD_HASH
 * - 不經過 API，不回傳密碼明文
 */
function setAdminCredentialsForSetup_(loginId, password) {
  var id = String(loginId || '').trim();
  var pw = String(password || '');
  if (!id || !pw) {
    throw new Error('請提供 loginId 與 password');
  }

  var props = PropertiesService.getScriptProperties();
  var salt = props.getProperty('AGENCY_SALT') || 'dev_salt';
  var hash = hashPassword_(id, pw, salt);

  props.setProperties({
    ADMIN_LOGIN_ID: id,
    ADMIN_PASSWORD_HASH: hash,
  });

  Logger.log('✅ 已更新後台登入帳號與密碼 Hash');
  Logger.log('ADMIN_LOGIN_ID = ' + id);
  Logger.log('ADMIN_PASSWORD_HASH = ' + hash);
  return { success: true, loginId: id };
}

function hashPassword_(loginId, password, salt) {
  const raw = loginId + '::' + password + '::' + salt;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
  return Utilities.base64Encode(bytes);
}

function createToken_(loginId) {
  const cfg = getAgencyConfig_();
  const ts = Date.now();
  const raw = loginId + '::' + ts + '::' + cfg.TOKEN_SECRET;
  const sig = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
  );
  const token = loginId + '|' + ts + '|' + sig;
  return Utilities.base64EncodeWebSafe(token);
}

function verifyToken_(token) {
  if (!token) return null;
  const cfg = getAgencyConfig_();
  const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
  const parts = decoded.split('|');
  if (parts.length !== 3) return null;
  const loginId = parts[0];
  const ts = Number(parts[1]);
  const sig = parts[2];

  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 天
  if (Date.now() - ts > maxAgeMs) return null;

  const raw = loginId + '::' + ts + '::' + cfg.TOKEN_SECRET;
  const expected = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
  );
  if (expected !== sig) return null;
  return loginId;
}

function verifyAdminToken_(token) {
  const loginId = verifyToken_(token);
  if (!loginId) return null;
  if (String(loginId).indexOf('admin:') !== 0) return null;
  return loginId.slice(6) || null;
}

function getAgencySheets_() {
  const ss = SpreadsheetApp.openById(Config.SHEET_ID);
  const accounts = ss.getSheetByName('AgencyAccounts') || ss.insertSheet('AgencyAccounts');
  const props = ss.getSheetByName('AgencyProperties') || ss.insertSheet('AgencyProperties');
  const blocks = ss.getSheetByName('AgencyBlocks') || ss.insertSheet('AgencyBlocks');

  if ((accounts.getLastRow() || 0) < 1) {
    accounts.appendRow([
      'agencyId',
      'loginId',
      'passwordHash',
      'displayName',
      'createdAt',
      'isActive',
      'adminNote',
      'approvalStatus', // pending / approved / rejected
      'visiblePartners', // JSON 陣列字串，如 '["dropinn"]'
    ]);
  } else {
    // 舊資料表補欄位（若尚未有）
    var header = accounts.getRange(1, 1, 1, accounts.getLastColumn()).getValues()[0];
    if (header.indexOf('approvalStatus') === -1) {
      accounts.getRange(1, header.length + 1).setValue('approvalStatus');
    }
    if (header.indexOf('visiblePartners') === -1) {
      var hlen = accounts.getRange(1, 1, 1, accounts.getLastColumn()).getValues()[0].length;
      accounts.getRange(1, hlen + 1).setValue('visiblePartners');
    }
  }

  if ((props.getLastRow() || 0) < 1) {
    props.appendRow([
      'propertyId',
      'agencyId',
      'propertyName',
      'sortOrder',
      'isActive',
      'colorKey',
    ]);
  }
  if ((blocks.getLastRow() || 0) < 1) {
    blocks.appendRow(['propertyId', 'date', 'createdAt', 'updatedAt', 'source']);
  }
  // AgencyGroups 工作表
  const groups = ss.getSheetByName('AgencyGroups') || ss.insertSheet('AgencyGroups');
  if ((groups.getLastRow() || 0) < 1) {
    groups.appendRow(['groupId', 'groupName', 'members', 'createdAt']);
  }
  ensureAgencySeedData_();
  return { accounts: accounts, props: props, blocks: blocks, groups: groups };
}

function normalizeDateStr_(input) {
  if (!input) return '';
  const d = new Date(input);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
  }
  const s = String(input).trim();
  // 允許 YYYY-MM-DD 直接過
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

function findAgencyByLoginId_(accountsSheet, loginId) {
  const data = accountsSheet.getDataRange().getValues();
  if (!data || data.length < 2) return null;
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxAgencyId = header.indexOf('agencyId');
  const idxName = header.indexOf('displayName');
  const idxActive = header.indexOf('isActive');
  const idxApproval = header.indexOf('approvalStatus');
  const idxVisible = header.indexOf('visiblePartners');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxLogin]) === String(loginId)) {
      var approval = idxApproval !== -1 ? String(data[i][idxApproval]) : 'approved';
      var visibleRaw = idxVisible !== -1 ? String(data[i][idxVisible]) : '[]';
      var visiblePartners = [];
      try {
        visiblePartners = JSON.parse(visibleRaw || '[]');
      } catch (e) {}
      return {
        agencyId: data[i][idxAgencyId],
        displayName: data[i][idxName],
        isActive: String(data[i][idxActive]) !== 'FALSE',
        approvalStatus: approval,
        visiblePartners: visiblePartners,
      };
    }
  }
  return null;
}

function ensureAgencySeedData_() {
  // 停用內建測試帳號自動建立，避免預設弱密碼存在
  return;
}

function ensureDefaultAgencyProperties_(agencyId, displayName) {
  const sheets = getAgencySheets_();
  const props = sheets.props;
  const data = props.getDataRange().getValues();
  const header = data[0];
  const idxPA = header.indexOf('agencyId');
  if (idxPA === -1) return;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxPA]) === String(agencyId)) {
      return; // 已有棟別，不再自動建立
    }
  }
  // 預設建立 1 棟（同業可先用起來；之後再擴充新增棟別）
  const baseName = (displayName || '').trim() || '我的民宿';
  const propertyId = 'PROP_' + agencyId;
  props.appendRow([propertyId, agencyId, baseName + ' A 棟', 1, true, 'A']);
}

// ================================
// 同業：業務函式
// ================================
function agencyRegister_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const cfg = getAgencyConfig_();
  const loginId = (payload.loginId || '').trim();
  const password = payload.password || '';
  const displayName = (payload.displayName || '').trim();

  if (!loginId || !password || !displayName) {
    return { success: false, message: '缺少必填欄位' };
  }

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxLogin]) === loginId) {
      return { success: false, message: '此帳號已存在' };
    }
  }

  const agencyId = 'AGY_' + new Date().getTime();
  const hash = hashPassword_(loginId, password, cfg.SALT);
  accounts.appendRow([
    agencyId,
    loginId,
    hash,
    displayName,
    new Date(),
    false,
    '',
    'pending',
    '["AGY_DROPINN"]',
  ]);

  return { success: true, pending: true, message: '申請已送出，等待雫旅確認後即可登入' };
}

function agencyLogin_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const cfg = getAgencyConfig_();
  const loginId = (payload.loginId || '').trim();
  const password = payload.password || '';

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxHash = header.indexOf('passwordHash');
  const idxAgencyId = header.indexOf('agencyId');
  const idxActive = header.indexOf('isActive');
  const idxName = header.indexOf('displayName');
  const idxApproval = header.indexOf('approvalStatus');

  const targetHash = hashPassword_(loginId, password, cfg.SALT);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxLogin]) !== loginId) continue;
    if (String(data[i][idxHash]) !== targetHash) {
      return { success: false, message: '帳號或密碼錯誤' };
    }

    var approval = idxApproval !== -1 ? String(data[i][idxApproval]) : 'approved';
    if (approval === 'pending') {
      return { success: false, pending: true, message: '申請仍在審核中，請稍候通知' };
    }
    if (approval === 'rejected') {
      return { success: false, rejected: true, message: '申請未通過，請聯絡雫旅' };
    }
    if (String(data[i][idxActive]) === 'FALSE') {
      return { success: false, message: '帳號已停用' };
    }

    var token = createToken_(loginId);
    ensureDefaultAgencyProperties_(data[i][idxAgencyId], data[i][idxName]);
    return {
      success: true,
      token: token,
      agencyId: data[i][idxAgencyId],
      displayName: data[i][idxName],
    };
  }
  // Admin 帳號也可以登入同業系統
  const adminCfg = getAdminAuthConfig_();
  if (adminCfg.loginId && adminCfg.passwordHash) {
    const adminHash = hashPassword_(loginId, password, adminCfg.salt);
    if (loginId === adminCfg.loginId && adminHash === adminCfg.passwordHash) {
      var adminToken = createToken_('admin:' + loginId);
      return {
        success: true,
        token: adminToken,
        agencyId: 'AGY_DROPINN',
        displayName: '雫旅 Drop Inn',
        isAdmin: true,
      };
    }
  }
  return { success: false, message: '帳號或密碼錯誤' };
}

function adminLogin_(payload) {
  const loginId = (payload.loginId || '').trim();
  const password = payload.password || '';
  if (!loginId || !password) return { success: false, message: '請輸入帳號與密碼' };

  const cfg = getAdminAuthConfig_();
  if (!cfg.loginId || !cfg.passwordHash) {
    return {
      success: false,
      message: '後台帳號尚未設定，請在 Script Properties 設定 ADMIN_LOGIN_ID / ADMIN_PASSWORD_HASH',
    };
  }

  const hash = hashPassword_(loginId, password, cfg.salt);
  if (loginId !== cfg.loginId || hash !== cfg.passwordHash) {
    return { success: false, message: '帳號或密碼錯誤' };
  }

  return { success: true, token: createToken_('admin:' + loginId) };
}

function agencyGetProperties_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const props = sheets.props;
  const accounts = sheets.accounts;

  const agency = findAgencyByLoginId_(accounts, agencyLoginId);
  var agencyId = agency && agency.isActive ? agency.agencyId : null;
  if (!agencyId) return { success: false, message: '無效帳號' };

  const data = props.getDataRange().getValues();
  const header = data[0];
  const idxPId = header.indexOf('propertyId');
  const idxAId = header.indexOf('agencyId');
  const idxName = header.indexOf('propertyName');
  const idxSort = header.indexOf('sortOrder');
  const idxActive = header.indexOf('isActive');
  const idxColor = header.indexOf('colorKey');

  var list = [];
  for (var j = 1; j < data.length; j++) {
    if (String(data[j][idxAId]) === String(agencyId)) {
      if (idxActive !== -1 && String(data[j][idxActive]) === 'FALSE') continue;
      list.push({
        id: data[j][idxPId],
        name: data[j][idxName],
        sortOrder: data[j][idxSort] || 0,
        colorKey: idxColor !== -1 ? data[j][idxColor] : '',
      });
    }
  }
  list.sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  return { success: true, properties: list, agencyId: agencyId };
}

function agencyGetBlocks_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const blocks = sheets.blocks;
  const props = sheets.props;
  const accounts = sheets.accounts;
  const propertyId = payload.propertyId;

  if (!propertyId) return { success: false, message: '缺少 propertyId' };

  const agency = findAgencyByLoginId_(accounts, agencyLoginId);
  if (!agency || !agency.isActive) return { success: false, message: '無效帳號' };
  // 防止跨同業讀取：先確認 propertyId 屬於此 agencyId
  const pData = props.getDataRange().getValues();
  const pHeader = pData[0];
  const idxPId = pHeader.indexOf('propertyId');
  const idxAId = pHeader.indexOf('agencyId');
  var belongs = false;
  for (var k = 1; k < pData.length; k++) {
    if (
      String(pData[k][idxPId]) === String(propertyId) &&
      String(pData[k][idxAId]) === String(agency.agencyId)
    ) {
      belongs = true;
      break;
    }
  }
  if (!belongs) return { success: false, message: '無權限存取該棟別' };

  const data = blocks.getDataRange().getValues();
  const header = data[0];
  const idxBPId = header.indexOf('propertyId');
  const idxDate = header.indexOf('date');

  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxBPId]) === String(propertyId)) {
      const ds = normalizeDateStr_(data[i][idxDate]);
      if (ds) list.push(ds);
    }
  }
  list.sort();
  return { success: true, blocks: list };
}

function agencyGetAllBlocks_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const blocksSheet = sheets.blocks;
  const propsSheet = sheets.props;
  const accountsSheet = sheets.accounts;

  const agency = findAgencyByLoginId_(accountsSheet, agencyLoginId);
  if (!agency || !agency.isActive) return { success: false, message: '無效帳號' };

  const propsData = propsSheet.getDataRange().getValues();
  const pHeader = propsData[0] || [];
  const idxPId = pHeader.indexOf('propertyId');
  const idxAId = pHeader.indexOf('agencyId');
  const idxActive = pHeader.indexOf('isActive');
  const idxName = pHeader.indexOf('propertyName');
  const idxSort = pHeader.indexOf('sortOrder');
  const idxColor = pHeader.indexOf('colorKey');

  const properties = [];
  const propertyIdSet = {};
  for (var i = 1; i < propsData.length; i++) {
    if (String(propsData[i][idxAId]) !== String(agency.agencyId)) continue;
    if (idxActive !== -1 && String(propsData[i][idxActive]) === 'FALSE') continue;
    const pid = propsData[i][idxPId];
    if (!pid) continue;
    propertyIdSet[String(pid)] = true;
    properties.push({
      id: pid,
      name: idxName !== -1 ? propsData[i][idxName] : String(pid),
      sortOrder: idxSort !== -1 ? propsData[i][idxSort] : 0,
      colorKey: idxColor !== -1 ? propsData[i][idxColor] : '',
    });
  }
  properties.sort(function (a, b) {
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });

  const blocksData = blocksSheet.getDataRange().getValues();
  const bHeader = blocksData[0] || [];
  const idxBPId = bHeader.indexOf('propertyId');
  const idxDate = bHeader.indexOf('date');

  const blocksByProperty = {};
  properties.forEach(function (p) {
    blocksByProperty[String(p.id)] = [];
  });
  for (var j = 1; j < blocksData.length; j++) {
    const pid = blocksData[j][idxBPId];
    if (!pid || !propertyIdSet[String(pid)]) continue;
    const ds = normalizeDateStr_(blocksData[j][idxDate]);
    if (!ds) continue;
    blocksByProperty[String(pid)].push(ds);
  }
  Object.keys(blocksByProperty).forEach(function (k) {
    blocksByProperty[k].sort();
  });

  return { success: true, properties: properties, blocksByProperty: blocksByProperty };
}

function agencySetBlock_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const blocks = sheets.blocks;
  const props = sheets.props;
  const accounts = sheets.accounts;
  const propertyId = payload.propertyId;
  var date = payload.date;

  if (!propertyId || !date) return { success: false, message: '缺少參數' };

  const agency = findAgencyByLoginId_(accounts, agencyLoginId);
  if (!agency || !agency.isActive) return { success: false, message: '無效帳號' };
  // 防止跨同業寫入：先確認 propertyId 屬於此 agencyId
  const pData = props.getDataRange().getValues();
  const pHeader = pData[0];
  const idxPId = pHeader.indexOf('propertyId');
  const idxAId = pHeader.indexOf('agencyId');
  var belongs = false;
  for (var k = 1; k < pData.length; k++) {
    if (
      String(pData[k][idxPId]) === String(propertyId) &&
      String(pData[k][idxAId]) === String(agency.agencyId)
    ) {
      belongs = true;
      break;
    }
  }
  if (!belongs) return { success: false, message: '無權限存取該棟別' };

  var normDate = normalizeDateStr_(date);
  if (!normDate) return { success: false, message: '日期格式不正確' };

  var range = blocks.getDataRange();
  var values = range.getValues();
  var header = values[0];
  var idxBPropertyId = header.indexOf('propertyId');
  var idxDate = header.indexOf('date');
  var idxUpdatedAt = header.indexOf('updatedAt');
  var idxSource = header.indexOf('source');

  var rowToDelete = null;
  for (var i = 1; i < values.length; i++) {
    var d = normalizeDateStr_(values[i][idxDate]);
    if (String(values[i][idxBPropertyId]) === String(propertyId) && d === normDate) {
      rowToDelete = i + 1;
      break;
    }
  }

  if (rowToDelete) {
    blocks.deleteRow(rowToDelete);
  } else {
    blocks.appendRow([propertyId, normDate, new Date(), new Date(), 'agency']);
  }

  return { success: true };
}

function agencyAddProperty_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const agency = findAgencyByLoginId_(sheets.accounts, agencyLoginId);
  if (!agency || !agency.isActive) return { success: false, message: '無效帳號' };
  const name = (payload.propertyName || '').trim();
  if (!name) return { success: false, message: '請填寫棟別名稱' };
  var ckRaw = String(payload.colorKey || 'A').trim();
  const colorKey = (ckRaw[0] || 'A').toUpperCase();
  const propertyId = 'PROP_' + agency.agencyId + '_' + Date.now();
  const data = sheets.props.getDataRange().getValues();
  const header = data[0];
  const idxAId = header.indexOf('agencyId');
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxAId]) === String(agency.agencyId)) count++;
  }
  sheets.props.appendRow([propertyId, agency.agencyId, name, count + 1, true, colorKey]);
  return { success: true, propertyId: propertyId, message: '棟別已新增' };
}

function agencyUpdateProperty_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const agency = findAgencyByLoginId_(sheets.accounts, agencyLoginId);
  if (!agency || !agency.isActive) return { success: false, message: '無效帳號' };
  const pid = payload.propertyId;
  const newName = (payload.propertyName || '').trim();
  if (!pid || !newName) return { success: false, message: '缺少參數' };
  const data = sheets.props.getDataRange().getValues();
  const header = data[0];
  const idxPId = header.indexOf('propertyId');
  const idxAId = header.indexOf('agencyId');
  const idxName = header.indexOf('propertyName');
  for (var j = 1; j < data.length; j++) {
    if (
      String(data[j][idxPId]) === String(pid) &&
      String(data[j][idxAId]) === String(agency.agencyId)
    ) {
      sheets.props.getRange(j + 1, idxName + 1).setValue(newName);
      return { success: true, message: '已更新' };
    }
  }
  return { success: false, message: '找不到棟別或無權限' };
}

function agencyGetPartnerCalendar_(payload, agencyLoginId) {
  const sheets = getAgencySheets_();
  const isAdmin = String(agencyLoginId).indexOf('admin:') === 0;
  const agency = isAdmin ? null : findAgencyByLoginId_(sheets.accounts, agencyLoginId);
  if (!isAdmin && (!agency || !agency.isActive)) return { success: false, message: '無效帳號' };

  // 先從群組取得可見的 agencyId 清單
  var visibleIds = isAdmin ? [] : (getVisiblePartnersByGroup_(agency.agencyId, sheets.groups) || []);
  // 如果群組裡沒有，fallback 到舊的 visiblePartners（向下相容）
  if (!isAdmin && !visibleIds.length) {
    visibleIds = agency.visiblePartners || [];
  }

  const propsData = sheets.props.getDataRange().getValues();
  const pHeader = propsData[0] || [];
  const idxPId = pHeader.indexOf('propertyId');
  const idxPAId = pHeader.indexOf('agencyId');
  const idxPName = pHeader.indexOf('propertyName');
  const idxPActive = pHeader.indexOf('isActive');

  const blocksData = sheets.blocks.getDataRange().getValues();
  const bHeader = blocksData[0] || [];
  const idxBPId = bHeader.indexOf('propertyId');
  const idxBDate = bHeader.indexOf('date');

  const accData = sheets.accounts.getDataRange().getValues();
  const aHeader = accData[0] || [];
  const idxAId = aHeader.indexOf('agencyId');
  const idxAName = aHeader.indexOf('displayName');
  const idxALogin = aHeader.indexOf('loginId');
  const agencyNames = {};
  const agencyLogins = {};
  for (var a = 1; a < accData.length; a++) {
    agencyNames[String(accData[a][idxAId])] = accData[a][idxAName];
    agencyLogins[String(accData[a][idxAId])] = accData[a][idxALogin];
  }

  var visibleSet = {};
  visibleIds.forEach(function (id) {
    visibleSet[String(id)] = true;
  });
  // 自己的民宿一律顯示在 & 視角（不論有無群組）
  if (agency) visibleSet[String(agency.agencyId)] = true;

  var properties = [];
  var propertyIdSet = {};
  for (var i = 1; i < propsData.length; i++) {
    var aid = String(propsData[i][idxPAId]);
    // admin 可看全部；一般業者只看 visibleSet
    if (!isAdmin && !visibleSet[aid]) continue;
    if (idxPActive !== -1 && String(propsData[i][idxPActive]) === 'FALSE') continue;
    var pid = propsData[i][idxPId];
    if (!pid) continue;
    propertyIdSet[String(pid)] = aid;
    properties.push({
      agencyId: aid,
      agencyName: agencyNames[aid] || aid,
      agencyLoginId: agencyLogins[aid] || aid,
      propertyId: pid,
      propertyName: idxPName !== -1 ? propsData[i][idxPName] : String(pid),
    });
  }

  var blocksByProperty = {};
  properties.forEach(function (p) {
    blocksByProperty[String(p.propertyId)] = [];
  });
  for (var j = 1; j < blocksData.length; j++) {
    var pid = blocksData[j][idxBPId];
    if (!pid || !propertyIdSet[String(pid)]) continue;
    var ds = normalizeDateStr_(blocksData[j][idxBDate]);
    if (!ds) continue;
    blocksByProperty[String(pid)].push(ds);
  }
  Object.keys(blocksByProperty).forEach(function (k) {
    blocksByProperty[k].sort();
  });

  var dropinnBooked = [];
  var dropinnPending = [];
  try {
    var orders = DataStore.getOrders();
    var bookedSet = {};
    var pendingSet = {};
    orders.forEach(function (order) {
      if (!order.checkIn || !order.checkOut) return;
      var cur = new Date(order.checkIn);
      var end = new Date(order.checkOut);
      cur.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      while (cur < end) {
        var ds = cur.toISOString().slice(0, 10);
        if (order.status === '已付訂') bookedSet[ds] = true;
        else if (order.status === '洽談中') pendingSet[ds] = true;
        cur.setDate(cur.getDate() + 1);
      }
    });
    dropinnBooked = Object.keys(bookedSet).sort();
    dropinnPending = Object.keys(pendingSet).sort();
  } catch (e) {}

  return {
    success: true,
    myAgencyId: agency ? agency.agencyId : 'admin',
    properties: properties,
    blocksByProperty: blocksByProperty,
    dropinnBooked: dropinnBooked,
    dropinnPending: dropinnPending,
  };
}

// ================================
// 合作群組
// ================================
function getVisiblePartnersByGroup_(agencyId, groupsSheet) {
  if (!groupsSheet) return [];
  try {
    var data = groupsSheet.getDataRange().getValues();
    if (!data || data.length < 2) return [];
    var header = data[0];
    var idxMembers = header.indexOf('members');
    if (idxMembers === -1) return [];
    var visibleSet = {};
    for (var i = 1; i < data.length; i++) {
      var raw = String(data[i][idxMembers] || '[]');
      var members = [];
      try {
        members = JSON.parse(raw);
      } catch (e) {}
      if (members.indexOf(agencyId) !== -1) {
        members.forEach(function (m) {
          if (m !== agencyId) visibleSet[m] = true;
        });
      }
    }
    return Object.keys(visibleSet);
  } catch (e) {
    return [];
  }
}

function agencyGroupList_() {
  const sheets = getAgencySheets_();
  const groups = sheets.groups;
  if (!groups) return { success: false, message: '群組功能尚未啟用' };

  const accData = sheets.accounts.getDataRange().getValues();
  const aHeader = accData[0] || [];
  const idxAId = aHeader.indexOf('agencyId');
  const idxAName = aHeader.indexOf('displayName');
  const idxALogin = aHeader.indexOf('loginId');
  const idxAApproval = aHeader.indexOf('approvalStatus');
  const approvedAgencies = {};
  for (var a = 1; a < accData.length; a++) {
    var approval = idxAApproval !== -1 ? String(accData[a][idxAApproval]) : 'approved';
    if (approval === 'approved') {
      approvedAgencies[String(accData[a][idxAId])] = {
        displayName: accData[a][idxAName],
        loginId: idxALogin !== -1 ? String(accData[a][idxALogin]) : '',
      };
    }
  }

  const data = groups.getDataRange().getValues();
  const header = data[0] || [];
  const idxGId = header.indexOf('groupId');
  const idxGName = header.indexOf('groupName');
  const idxMembers = header.indexOf('members');
  const idxCreated = header.indexOf('createdAt');

  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][idxGId]) continue;
    var raw = String(data[i][idxMembers] || '[]');
    var members = [];
    try {
      members = JSON.parse(raw);
    } catch (e) {}
    list.push({
      groupId: data[i][idxGId],
      groupName: data[i][idxGName],
      members: members,
      memberNames: members.map(function (m) {
        var ag = approvedAgencies[m];
        return { agencyId: m, displayName: (ag && ag.displayName) || m };
      }),
      createdAt: data[i][idxCreated],
    });
  }

  var approvedList = Object.keys(approvedAgencies).map(function (id) {
    return { agencyId: id, displayName: approvedAgencies[id].displayName, loginId: approvedAgencies[id].loginId };
  });

  return { success: true, groups: list, approvedAgencies: approvedList };
}

function agencyGroupCreate_(payload) {
  const sheets = getAgencySheets_();
  const groups = sheets.groups;
  if (!groups) return { success: false, message: '群組功能尚未啟用' };
  const name = (payload.groupName || '').trim();
  if (!name) return { success: false, message: '請輸入群組名稱' };
  const groupId = 'GRP_' + new Date().getTime();
  groups.appendRow([groupId, name, '[]', new Date()]);
  return { success: true, groupId: groupId, message: '已建立群組「' + name + '」' };
}

function agencyGroupAddMember_(payload) {
  const sheets = getAgencySheets_();
  const groups = sheets.groups;
  if (!groups) return { success: false, message: '群組功能尚未啟用' };
  const groupId = (payload.groupId || '').trim();
  const agencyId = (payload.agencyId || '').trim();
  if (!groupId || !agencyId) return { success: false, message: '缺少必要參數' };

  const data = groups.getDataRange().getValues();
  const header = data[0];
  const idxGId = header.indexOf('groupId');
  const idxMembers = header.indexOf('members');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxGId]) !== groupId) continue;
    var members = [];
    try {
      members = JSON.parse(String(data[i][idxMembers] || '[]'));
    } catch (e) {}
    if (members.indexOf(agencyId) !== -1) return { success: false, message: '該業者已在群組中' };
    members.push(agencyId);
    groups.getRange(i + 1, idxMembers + 1).setValue(JSON.stringify(members));
    return { success: true, message: '已加入群組' };
  }
  return { success: false, message: '找不到群組' };
}

function agencyGroupRemoveMember_(payload) {
  const sheets = getAgencySheets_();
  const groups = sheets.groups;
  if (!groups) return { success: false, message: '群組功能尚未啟用' };
  const groupId = (payload.groupId || '').trim();
  const agencyId = (payload.agencyId || '').trim();
  if (!groupId || !agencyId) return { success: false, message: '缺少必要參數' };

  const data = groups.getDataRange().getValues();
  const header = data[0];
  const idxGId = header.indexOf('groupId');
  const idxMembers = header.indexOf('members');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxGId]) !== groupId) continue;
    var members = [];
    try {
      members = JSON.parse(String(data[i][idxMembers] || '[]'));
    } catch (e) {}
    var newMembers = members.filter(function (m) {
      return m !== agencyId;
    });
    groups.getRange(i + 1, idxMembers + 1).setValue(JSON.stringify(newMembers));
    return { success: true, message: '已移除成員' };
  }
  return { success: false, message: '找不到群組' };
}

function agencyLoginIdMatch_(cellVal, target) {
  return (
    String(cellVal || '')
      .trim()
      .toLowerCase() ===
    String(target || '')
      .trim()
      .toLowerCase()
  );
}

/** 與試算表儲存格比對：pending / approved / rejected */
function normalizeAgencyApprovalStatus_(val) {
  var s = String(val || '')
    .trim()
    .toLowerCase();
  if (!s) return 'approved';
  return s;
}

function isAgencyRowMarkedActive_(cellVal) {
  var s = String(cellVal || '').trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1';
}

function agencyApprove_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const targetLoginId = (payload.targetLoginId || '').trim();
  if (!targetLoginId) return { success: false, message: '缺少 targetLoginId' };

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxActive = header.indexOf('isActive');
  const idxApproval = header.indexOf('approvalStatus');
  const idxVisible = header.indexOf('visiblePartners');
  const idxAgencyId = header.indexOf('agencyId');
  const idxName = header.indexOf('displayName');

  for (var i = 1; i < data.length; i++) {
    if (!agencyLoginIdMatch_(data[i][idxLogin], targetLoginId)) continue;
    var rowNum = i + 1;
    if (idxActive !== -1) accounts.getRange(rowNum, idxActive + 1).setValue(true);
    if (idxApproval !== -1) accounts.getRange(rowNum, idxApproval + 1).setValue('approved');
    if (idxVisible !== -1) {
      var current = String(data[i][idxVisible] || '[]');
      if (current === '[]' || current === '') {
        accounts.getRange(rowNum, idxVisible + 1).setValue('[]');
      }
    }
    ensureDefaultAgencyProperties_(data[i][idxAgencyId], data[i][idxName]);
    return { success: true, message: targetLoginId + ' 已核准' };
  }
  return { success: false, message: '找不到帳號' };
}

function agencyReject_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const targetLoginId = (payload.targetLoginId || '').trim();
  if (!targetLoginId) return { success: false, message: '缺少 targetLoginId' };

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxApproval = header.indexOf('approvalStatus');
  const idxActive = header.indexOf('isActive');

  for (var i = 1; i < data.length; i++) {
    if (!agencyLoginIdMatch_(data[i][idxLogin], targetLoginId)) continue;
    var rowNum = i + 1;
    if (idxApproval !== -1) accounts.getRange(rowNum, idxApproval + 1).setValue('rejected');
    if (idxActive !== -1) accounts.getRange(rowNum, idxActive + 1).setValue(false);
    return { success: true, message: targetLoginId + ' 已拒絕' };
  }
  return { success: false, message: '找不到帳號' };
}

function agencyDelete_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const targetLoginId = (payload.targetLoginId || '').trim();
  if (!targetLoginId) return { success: false, message: '缺少 targetLoginId' };

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');

  const idxAgencyIdDel = header.indexOf('agencyId');
  for (var i = 1; i < data.length; i++) {
    if (!agencyLoginIdMatch_(data[i][idxLogin], targetLoginId)) continue;
    if (idxAgencyIdDel !== -1 && String(data[i][idxAgencyIdDel]) === 'AGY_DROPINN') {
      return { success: false, message: '無法刪除雫旅主帳號' };
    }
    // deleteRow is 1-indexed
    accounts.deleteRow(i + 1);
    return { success: true, message: targetLoginId + ' 已刪除' };
  }
  return { success: false, message: '找不到帳號' };
}

function agencyGetPendingList_() {
  const sheets = getAgencySheets_();
  const data = sheets.accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxName = header.indexOf('displayName');
  const idxApproval = header.indexOf('approvalStatus');
  const idxCreated = header.indexOf('createdAt');
  const idxAgencyId = header.indexOf('agencyId');
  const idxActive = header.indexOf('isActive');

  var list = [];
  var seenLogin = {};
  for (var i = 1; i < data.length; i++) {
    var approval = normalizeAgencyApprovalStatus_(
      idxApproval !== -1 ? data[i][idxApproval] : 'approved'
    );
    if (approval !== 'pending') continue;
    // 已核准／已啟用者不得出現在待審（防欄位不一致：例如已核准仍寫 pending）
    if (idxActive !== -1 && isAgencyRowMarkedActive_(data[i][idxActive])) continue;
    var lid = String(data[i][idxLogin] || '').trim();
    if (!lid || seenLogin[lid.toLowerCase()]) continue;
    seenLogin[lid.toLowerCase()] = true;
    list.push({
      agencyId: data[i][idxAgencyId],
      loginId: data[i][idxLogin],
      displayName: data[i][idxName],
      createdAt: idxCreated !== -1 ? String(data[i][idxCreated]) : '',
    });
  }
  return { success: true, pending: list };
}

function agencySetVisiblePartners_(payload) {
  const sheets = getAgencySheets_();
  const accounts = sheets.accounts;
  const targetLoginId = (payload.targetLoginId || '').trim();
  var partners = payload.visiblePartners;
  if (!targetLoginId) return { success: false, message: '缺少 targetLoginId' };
  if (!Array.isArray(partners)) return { success: false, message: 'visiblePartners 需為陣列' };

  const data = accounts.getDataRange().getValues();
  const header = data[0];
  const idxLogin = header.indexOf('loginId');
  const idxVisible = header.indexOf('visiblePartners');
  if (idxVisible === -1) return { success: false, message: '資料表缺少 visiblePartners 欄位' };

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxLogin]) !== targetLoginId) continue;
    accounts.getRange(i + 1, idxVisible + 1).setValue(JSON.stringify(partners));
    return { success: true, message: '已更新可見同業清單' };
  }
  return { success: false, message: '找不到帳號' };
}

function adminGetAllAgencyData_() {
  const sheets = getAgencySheets_();
  const accData = sheets.accounts.getDataRange().getValues();
  const propsData = sheets.props.getDataRange().getValues();
  const blocksData = sheets.blocks.getDataRange().getValues();
  const aHeader = accData[0] || [];
  const idxAId = aHeader.indexOf('agencyId');
  const idxName = aHeader.indexOf('displayName');
  const idxLogin = aHeader.indexOf('loginId');
  const idxActive = aHeader.indexOf('isActive');
  const idxApprovalA = aHeader.indexOf('approvalStatus');
  const agencies = [];
  for (var i = 1; i < accData.length; i++) {
    if (String(accData[i][idxActive]) === 'FALSE') continue;
    var appr = normalizeAgencyApprovalStatus_(
      idxApprovalA !== -1 ? accData[i][idxApprovalA] : 'approved'
    );
    if (appr === 'pending' || appr === 'rejected') continue;
    agencies.push({
      agencyId: accData[i][idxAId],
      displayName: accData[i][idxName],
      loginId: accData[i][idxLogin],
    });
  }
  const pHeader = propsData[0] || [];
  const idxPId = pHeader.indexOf('propertyId');
  const idxPAId = pHeader.indexOf('agencyId');
  const idxPName = pHeader.indexOf('propertyName');
  const idxColor = pHeader.indexOf('colorKey');
  const idxPActive = pHeader.indexOf('isActive');
  const propertiesByAgency = {};
  for (var j = 1; j < propsData.length; j++) {
    if (String(propsData[j][idxPActive]) === 'FALSE') continue;
    const aid = String(propsData[j][idxPAId]);
    if (!propertiesByAgency[aid]) propertiesByAgency[aid] = [];
    propertiesByAgency[aid].push({
      propertyId: propsData[j][idxPId],
      propertyName: propsData[j][idxPName],
      colorKey: idxColor !== -1 ? propsData[j][idxColor] : 'A',
    });
  }
  const bHeader = blocksData[0] || [];
  const idxBPId = bHeader.indexOf('propertyId');
  const idxBDate = bHeader.indexOf('date');
  const blocksByProperty = {};
  for (var k = 1; k < blocksData.length; k++) {
    const pid = String(blocksData[k][idxBPId]);
    const ds = normalizeDateStr_(blocksData[k][idxBDate]);
    if (!ds) continue;
    if (!blocksByProperty[pid]) blocksByProperty[pid] = [];
    blocksByProperty[pid].push(ds);
  }
  return {
    success: true,
    agencies: agencies,
    propertiesByAgency: propertiesByAgency,
    blocksByProperty: blocksByProperty,
  };
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: '請求內容為空，請重試' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    let result = {};

    // ==========================================
    // Admin 權限檢查（僅針對後台相關 action）
    // ==========================================
    if (isAdminAction(action)) {
      const adminKey = requestData.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 訂房相關 API
    // ==========================================
    if (action === 'agencyRegister') {
      result = agencyRegister_(requestData);
    } else if (action === 'agencyLogin') {
      result = agencyLogin_(requestData);
    } else if (action === 'adminLogin') {
      result = adminLogin_(requestData);
    } else if (action === 'agencyGetProperties') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyGetProperties_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyGetBlocks') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyGetBlocks_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyGetAllBlocks') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyGetAllBlocks_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencySetBlock') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencySetBlock_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyAddProperty') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyAddProperty_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyUpdateProperty') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyUpdateProperty_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyGetPartnerCalendar') {
      const loginId = verifyToken_(requestData.token);
      result = loginId
        ? agencyGetPartnerCalendar_(requestData, loginId)
        : { success: false, message: '未登入' };
    } else if (action === 'agencyApprove') {
      result = agencyApprove_(requestData);
    } else if (action === 'agencyReject') {
      result = agencyReject_(requestData);
    } else if (action === 'agencyDelete') {
      result = agencyDelete_(requestData);
    } else if (action === 'agencyGetPendingList') {
      result = agencyGetPendingList_();
    } else if (action === 'agencySetVisiblePartners') {
      result = agencySetVisiblePartners_(requestData);
    } else if (action === 'agencyGroupList') {
      result = agencyGroupList_();
    } else if (action === 'agencyGroupCreate') {
      result = agencyGroupCreate_(requestData);
    } else if (action === 'agencyGroupAddMember') {
      result = agencyGroupAddMember_(requestData);
    } else if (action === 'agencyGroupRemoveMember') {
      result = agencyGroupRemoveMember_(requestData);
    } else if (action === 'getMonthlyExpense') {
      result = getMonthlyExpense(requestData);
    } else if (action === 'saveMonthlyExpense') {
      result = saveMonthlyExpense(requestData);
    } else if (action === 'adminGetAllAgencyData') {
      result = adminGetAllAgencyData_();
    } else if (action === 'checkCoupon') {
      const code = requestData.code;
      const originalTotal = Number(requestData.originalTotal) || 0;
      const nights = Number(requestData.nights) || 0;
      result =
        typeof checkCoupon === 'function'
          ? checkCoupon(code, originalTotal, nights)
          : { valid: false, message: '服務未就緒' };
    } else if (action === 'createBooking') {
      // reCAPTCHA：僅記錄，不硬擋（避免 Google 驗證 API 超時卡住整個請求）
      try {
        const recaptchaToken = requestData.token;
        const adminKeyOk = typeof isValidAdminKey === 'function' && isValidAdminKey(requestData.adminKey);
        const isAdminBypass = recaptchaToken === 'ADMIN_BYPASS' || adminKeyOk;
        if (!isAdminBypass && recaptchaToken) {
          const rcOk = verifyRecaptcha(recaptchaToken);
          Logger.log('reCAPTCHA result:', rcOk);
        }
      } catch (rcErr) {
        Logger.log('reCAPTCHA check error (non-blocking):', rcErr);
      }

      let bookingData = requestData.data;
      if (!bookingData || typeof bookingData !== 'object') {
        bookingData = {};
        const skip = {
          action: true,
          adminKey: true,
          token: true,
          data: true,
          record: true,
        };
        Object.keys(requestData).forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(requestData, k) && !skip[k]) {
            bookingData[k] = requestData[k];
          }
        });
      }
      result = BookingService.handleCreateOrder(bookingData);
    } else if (action === 'getHousekeepingSchedule') {
      // 房務日程：獨立金鑰驗證，不含個人資料，不需要 admin 權限
      const hkKey = requestData.housekeepingKey || '';
      const configuredHkKey = Config.HOUSEKEEPING_KEY || '';
      if (configuredHkKey && hkKey !== configuredHkKey) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: '房務金鑰不正確' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const allOrders = DataStore.getOrders();
      result = (Array.isArray(allOrders) ? allOrders : [])
        .filter(o => o && (o.status === '洽談中' || o.status === '已付訂' || o.status === '預定中'))
        .map(o => ({
          checkIn:    o.checkIn    || '',
          checkOut:   o.checkOut   || '',
          rooms:      o.rooms      || 0,
          extraBeds:  o.extraBeds  || 0,
          status:     o.status     || '',
          housekeepingNote: o.housekeepingNote || '',
        }));
    }

    // ==========================================
    // Admin 後台 API
    // ==========================================
    else if (action === 'getAllOrders') {
      result = DataStore.getOrders();
    } else if (action === 'getOrderByID') {
      const orderID = requestData.orderID;
      const order = DataStore.getOrderByID(orderID);
      result = order ? { success: true, order } : { success: false, error: '找不到訂單' };
    } else if (action === 'updateOrder') {
      const orderID = requestData.orderID;
      const updates = requestData.updates;
      result = DataStore.updateOrder(orderID, updates);
    } else if (action === 'updateOrderAndSync') {
      const orderID = requestData.orderID;
      const updates = requestData.updates;
      result = updateOrderAndSyncInternal(orderID, updates);
    } else if (action === 'generateNotification') {
      const orderID = requestData.orderID;
      const changeType = requestData.changeType || '訂單更新';

      const order = DataStore.getOrderByID(orderID);
      if (!order) {
        result = { success: false, error: '找不到訂單' };
      } else {
        result = {
          success: true,
          lineText: generateLineNotification(order, changeType),
          hasEmail: !!order.email,
        };
      }
    } else if (action === 'sendNotificationEmail') {
      const orderID = requestData.orderID;
      result = sendNotificationEmailInternal(orderID);
    } else if (action === 'markCompletedOrders') {
      result = markCompletedOrdersInternal();
    }

    // ==========================================
    // 🆕 日曆管理 API
    // ==========================================
    else if (action === 'rebuildCalendars') {
      // 重建日曆
      result = rebuildCalendarsInternal();
    } else if (action === 'clearCalendars') {
      // 清空日曆
      result = clearCalendarsInternal();
    } else if (action === 'cleanupOldYear') {
      // 清理去年的事件
      result = cleanupOldYearInternal();
    } else if (action === 'getFinanceStats') {
      const year = requestData.year ? Number(requestData.year) : new Date().getFullYear();
      const month = requestData.month != null ? Number(requestData.month) : 0;
      result = getFinanceStatsInternal(year, month);
    } else if (action === 'getCostForOrder') {
      const orderID = requestData.orderID;
      const year = requestData.year != null ? Number(requestData.year) : new Date().getFullYear();
      result = getCostForOrderInternal(orderID, year);
    } else if (action === 'getDetailedFinanceReport') {
      const year = requestData.year ? Number(requestData.year) : new Date().getFullYear();
      const month = requestData.month != null ? Number(requestData.month) : 0;
      result = getDetailedFinanceReportInternal(year, month);
    } else if (action === 'getCoupons') {
      result = { success: true, coupons: DataStore.getCoupons() };
    } else if (action === 'saveCoupon') {
      result = saveCouponInternal(requestData.coupon);
    } else if (action === 'adminRunSetupSystem') {
      result = adminRunSetupSystem();
    } else if (action === 'adminInitializeYearSheet') {
      result = adminInitializeYearSheet(
        requestData.year != null ? Number(requestData.year) : undefined
      );
    } else if (action === 'adminQuickCheck') {
      result = adminQuickCheck();
    } else if (action === 'getRecommendationRecords') {
      result = { success: true, records: DataStore.getRecommendationRecords() };
    } else if (action === 'addRecommendationRecord') {
      result = DataStore.addRecommendationRecord(requestData.record || {});
    } else if (action === 'adminGetSettings') {
      result = adminGetSettings();
    } else if (action === 'adminSetSettings') {
      result = adminSetSettings(requestData.updates || {});
    } else if (action === 'getCalendarStats') {
      result = adminGetCalendarStats();
    }

    // ==========================================
    // 未知操作
    // ==========================================
    else {
      result = { success: false, error: '未知的操作: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    Logger.log('❌ doPost 錯誤:', error);
    Logger.log('錯誤堆疊:', error.stack);

    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'doPost');
    }

    // 對外僅回傳一般性錯誤訊息，避免洩漏內部細節
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: '系統忙碌或發生錯誤，請稍後再試或聯繫民宿',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理 GET 請求
 * ✅ 支援：Admin 後台、房務介面
 * ✅ 新增：getBookedDates（公開 API）
 * ✅ 新增：getCalendarStats（日曆統計）
 */
function doGet(e) {
  try {
    const page = e.parameter.page;
    const action = e.parameter.action;

    // 對需要 Admin 權限的 GET API 做金鑰檢查
    // （公開 API：getBookedDates / checkAvailability / 健康檢查則不檢查）
    if (action && isAdminAction(action)) {
      const adminKey = e.parameter.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 🆕 日曆統計 API
    // ==========================================
    if (action === 'getCalendarStats') {
      try {
        const stats = CalendarManager.getCalendarStats();
        return ContentService.createTextOutput(
          JSON.stringify({
            success: true,
            ...stats,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        Logger.log('❌ 取得日曆統計失敗:', error);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: error.message,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 🆕 公開 API - 取得已訂走的日期
    // ==========================================
    if (action === 'getBookedDates') {
      return getBookedDates();
    }

    // ==========================================
    // 🆕 公開 API - 即時可訂性檢查
    // ==========================================
    if (action === 'checkAvailability') {
      try {
        const checkIn = e.parameter.checkIn;
        const checkOut = e.parameter.checkOut;

        if (!checkIn || !checkOut) {
          return ContentService.createTextOutput(
            JSON.stringify({
              available: true,
              message: '缺少日期參數',
            })
          ).setMimeType(ContentService.MimeType.JSON);
        }

        const existingOrders = DataStore.getOrders();
        const newBooking = { checkIn, checkOut };
        const conflicts = [];

        const newStart = new Date(checkIn).getTime();
        const newEnd = new Date(checkOut).getTime();
        const validStatuses = ['洽談中', '已付訂'];

        for (const order of existingOrders) {
          if (!validStatuses.includes(order.status)) continue;
          const existingStart = new Date(order.checkIn).getTime();
          const existingEnd = new Date(order.checkOut).getTime();
          if (newStart < existingEnd && newEnd > existingStart) {
            conflicts.push({ checkIn: order.checkIn, checkOut: order.checkOut });
          }
        }

        return ContentService.createTextOutput(
          JSON.stringify({
            available: conflicts.length === 0,
            conflicts: conflicts,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(
          JSON.stringify({
            available: true,
            error: error.message,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // Admin API：取得所有訂單（GET）
    // ==========================================
    if (action === 'getAllOrders') {
      const adminKey = e && e.parameter && e.parameter.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      try {
        const allOrders = DataStore.getOrders();
        return ContentService.createTextOutput(JSON.stringify(allOrders)).setMimeType(
          ContentService.MimeType.JSON
        );
      } catch (err) {
        Logger.log('❌ getAllOrders 錯誤:', err);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: err.message || '讀取訂單失敗',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 顯示 Admin 後台（由 GAS 注入 API 網址與金鑰，無需 config.js）
    // ==========================================
    if (page === 'admin') {
      return HtmlService.createHtmlOutputFromFile('notforyou-login')
        .setTitle('雫旅｜notforyou')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    if (page === 'adminHome') {
      return HtmlService.createHtmlOutputFromFile('notforyou')
        .setTitle('雫旅｜notforyou')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // ==========================================
    // 顯示房務介面（由 GAS 注入設定，無需 config.js）
    // ==========================================
    if (page === 'housekeeping') {
      var hkTpl = HtmlService.createTemplateFromFile('housekeeping');
      return hkTpl
        .evaluate()
        .setTitle('雫旅｜restore the blank')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // ==========================================
    // API 請求：取得所有訂單
    // ==========================================
    if (action === 'getAllOrders') {
      try {
        const allOrders = DataStore.getOrders();
        return ContentService.createTextOutput(JSON.stringify(allOrders)).setMimeType(
          ContentService.MimeType.JSON
        );
      } catch (err) {
        Logger.log('❌ getAllOrders 錯誤:', err);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: err.message || '讀取訂單失敗',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 預設：健康檢查
    // ==========================================
    const status = {
      status: 'Alive',
      message: '雫旅 DROP INN API is running! 🚀',
      time: new Date().toISOString(),
      timestamp: new Date().getTime(),
      endpoints: {
        admin: '?page=admin',
        adminHome: '?page=adminHome',
        housekeeping: '?page=housekeeping',
        api: '?action=getAllOrders',
        calendar: '?action=getBookedDates',
        calendarStats: '?action=getCalendarStats',
      },
    };

    return ContentService.createTextOutput(JSON.stringify(status, null, 2)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    Logger.log('❌ doGet 錯誤:', error);
    Logger.log('錯誤堆疊:', error.stack);

    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'doGet');
    }

    // 對外僅回傳一般性錯誤訊息
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: '系統忙碌或發生錯誤，請稍後再試或聯繫民宿',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🆕 取得已訂走的日期列表（公開 API）
 * ⚠️ 注意：只返回日期，不包含任何個人資訊
 */
function getBookedDates() {
  try {
    const orders = DataStore.getOrders();
    const paidSet = new Set();     // 已付訂：顯示為已客滿（叉叉）
    const pendingSet = new Set();  // 洽談中：顯示為洽談中色塊

    // 時區安全的日期展開：避免 toISOString() UTC 偏移問題
    function expandDates(checkIn, checkOut) {
      const dates = [];
      if (!checkIn || !checkOut) return dates;

      // 統一轉為 YYYY-MM-DD 字串後用 new Date(y, m, d) 建立本地日期
      function parseLocalDate(v) {
        if (v instanceof Date) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
        var s = String(v).trim().slice(0, 10);
        var p = s.split('-');
        if (p.length !== 3) return new Date(NaN);
        return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
      }
      function fmtDate(d) {
        return (
          d.getFullYear() +
          '-' +
          String(d.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(d.getDate()).padStart(2, '0')
        );
      }

      var cur = parseLocalDate(checkIn);
      var end = parseLocalDate(checkOut);
      if (isNaN(cur.getTime()) || isNaN(end.getTime())) return dates;
      while (cur < end) {
        dates.push(fmtDate(cur));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    }

    orders.forEach(order => {
      var s = (order.status || '').trim();
      if (s === '取消' || !order.checkIn || !order.checkOut) return;
      var dates = expandDates(order.checkIn, order.checkOut);
      if (s === '已付訂') {
        dates.forEach(d => paidSet.add(d));
      } else if (s === '洽談中') {
        dates.forEach(d => pendingSet.add(d));
      }
    });

    const booked = Array.from(paidSet).sort();
    const pending = Array.from(pendingSet).sort();
    Logger.log(
      `📅 getBookedDates：已付訂 ${booked.length} 天；洽談中 ${pending.length} 天`
    );

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        booked: booked,   // 已付訂 → 已客滿（叉叉）
        pending: pending, // 洽談中 → 色塊
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('❌ getBookedDates 錯誤:', error);
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.message,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 生成 LINE 通知文字
 */
function generateLineNotification(order, changeType) {
  try {
    const nights = Math.ceil(
      (new Date(order.checkOut) - new Date(order.checkIn)) / (1000 * 60 * 60 * 24)
    );
    const bedsInfo = order.extraBeds > 0 ? ` + ${order.extraBeds} 加床` : '';

    let notificationText = `Hihi ${order.name} 👋

您的訂單已更新（${changeType}）

📋 訂單編號：${order.orderID}
📅 入住日期：${order.checkIn}
📅 退房日期：${order.checkOut}
🏠 包棟規模：${order.rooms} 間房${bedsInfo}
💰 費用總計：NT$ ${order.totalPrice.toLocaleString()}
`;

    // 如果有訂金資訊
    if (order.paidDeposit && order.paidDeposit > 0) {
      notificationText += `
💳 付款資訊
已付訂金：NT$ ${order.paidDeposit.toLocaleString()}
剩餘尾款：NT$ ${order.remainingBalance.toLocaleString()}
`;
    }

    notificationText += `
期待您的到來 ✨

━━━━━━━━━━━━━
雫旅 Drop Inn | 澎湖包棟民宿`;

    return notificationText.trim();
  } catch (error) {
    Logger.log('❌ 生成 LINE 通知文字失敗:', error);
    return `Hihi ${order.name}，您的訂單 ${order.orderID} 已更新。`;
  }
}

/**
 * ================================
 * Admin 專用內部邏輯（給 doPost & google.script.run 共用）
 * ================================
 */
function updateOrderAndSyncInternal(orderID, updates) {
  const orderBefore = DataStore.getOrderByID(orderID);
  // 成本表欄位不寫入訂單表，稍後單獨寫入支出_YYYY
  const costOnly = {
    rebateAmount: updates.rebateAmount,
    complimentaryAmount: updates.complimentaryAmount,
    otherCost: updates.otherCost,
    addonCost: updates.addonCost,
    note: updates.costNote != null ? updates.costNote : updates.note,
  };
  const orderUpdates = { ...updates };
  delete orderUpdates.rebateAmount;
  delete orderUpdates.complimentaryAmount;
  delete orderUpdates.otherCost;
  delete orderUpdates.addonCost;
  delete orderUpdates.costNote;

  let result = DataStore.updateOrder(orderID, orderUpdates);

  if (!result.success) {
    return result;
  }

  // 寫回成本表該列（若有傳成本欄位）
  if (
    costOnly.rebateAmount !== undefined ||
    costOnly.complimentaryAmount !== undefined ||
    costOnly.otherCost !== undefined ||
    costOnly.addonCost !== undefined ||
    costOnly.note !== undefined
  ) {
    const order = DataStore.getOrderByID(orderID);
    const year =
      order && order.checkIn ? new Date(order.checkIn).getFullYear() : new Date().getFullYear();
    DataStore.updateCostRowByOrderID(orderID, year, costOnly);
  }

  try {
    const order = DataStore.getOrderByID(orderID);
    const prevStatus = orderBefore ? orderBefore.status : '';

    // 狀態改為「取消」→ 刪除日曆、成本表該列清 0、寄取消信＋管理員信
    if (updates.status === '取消') {
      if (typeof CalendarService !== 'undefined') {
        CalendarService.deleteCalendarEvents(order);
        Logger.log('🗑️ 訂單已取消，日曆已清除: ' + orderID);
      }
      const year = order.checkIn ? new Date(order.checkIn).getFullYear() : new Date().getFullYear();
      DataStore.clearCostRowForOrder(orderID, year);
      if (typeof EmailService !== 'undefined') {
        try {
          EmailService.sendCancelEmail(order);
          EmailService.sendAdminStatusNotification(order, '取消');
        } catch (e) {
          Logger.log('⚠️ 取消信發送失敗: ' + e.message);
        }
      }
    }
    // 狀態改為「已付訂」→ 同步日曆、首次變已付訂則寄確認信＋管理員信
    else if (updates.status === '已付訂') {
      if (typeof CalendarService !== 'undefined') {
        if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
          CalendarService.deleteCalendarEvents(order);
        }
        CalendarService.syncOrderToCalendars(order);
        Logger.log('📅 訂單日曆已更新: ' + orderID);
      }
      var fromPending = prevStatus === '洽談中';
      if (fromPending) {
        if (typeof EmailService !== 'undefined') {
          try {
            const emailResult = EmailService.sendConfirmationEmail(order);
            if (emailResult && emailResult.success) {
              DataStore.updateOrder(orderID, { emailSent: new Date() });
              Logger.log('✅ emailSent 已標記: ' + orderID);
            }
            EmailService.sendAdminStatusNotification(order, '已付訂');
          } catch (e) {
            Logger.log('⚠️ 確認信發送失敗: ' + e.message);
          }
        }
      }
    }
    // 只是改日期 / 房數 / 加床 → 若狀態為已付訂，也要同步日曆
    else if (updates.checkIn || updates.checkOut || updates.rooms || updates.extraBeds) {
      const paidStatus = order.status === '已付訂';
      if (typeof CalendarService !== 'undefined' && paidStatus) {
        if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
          CalendarService.deleteCalendarEvents(order);
        }
        const updatedOrder = DataStore.getOrderByID(orderID);
        CalendarService.syncOrderToCalendars(updatedOrder);
        Logger.log('📅 訂單資訊已更新，日曆已同步: ' + orderID);
      }
    }

    result.message = '訂單已更新並同步日曆';
  } catch (calendarError) {
    Logger.log('⚠️ 日曆同步失敗但訂單已更新: ' + calendarError.message);
    result.message = '訂單已更新，但日曆同步失敗';
  }

  return result;
}

function sendNotificationEmailInternal(orderID) {
  const order = DataStore.getOrderByID(orderID);

  if (!order || !order.email) {
    return { success: false, error: '客人未提供 Email' };
  }

  if (typeof EmailService !== 'undefined') {
    return EmailService.sendConfirmationEmail(order);
  }

  return { success: false, error: 'EmailService 未定義' };
}

function markCompletedOrdersInternal() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const orders = DataStore.getOrders();
  let marked = 0;

  orders.forEach((order) => {
    if (order.status !== '已付訂') return;
    const checkOut = new Date(order.checkOut);
    checkOut.setHours(0, 0, 0, 0);
    if (checkOut < today) {
      const r = DataStore.updateOrder(order.orderID, { status: '完成' });
      if (r.success) marked++;
    }
  });

  return { success: true, marked };
}

function rebuildCalendarsInternal() {
  try {
    Logger.log('🔄 開始重建日曆...');

    CalendarManager.clearAllCalendars();

    const orders = DataStore.getOrders();
    const validOrders = orders.filter((order) => order.status === '已付訂');

    Logger.log('找到 ' + validOrders.length + ' 筆有效訂單');

    let successCount = 0;
    let rejectedCount = 0;

    validOrders.forEach((order, index) => {
      Logger.log('處理第 ' + (index + 1) + '/' + validOrders.length + ' 筆: ' + order.orderID);

      const syncResult = CalendarManager.syncOrderToCalendars(order);
      if (syncResult.success) {
        successCount++;
      } else {
        rejectedCount++;
      }

      if (index % 10 === 0 && index > 0) {
        Utilities.sleep(100);
      }
    });

    Logger.log('✅ 重建完成：成功 ' + successCount + ' 筆，拒絕 ' + rejectedCount + ' 筆');

    return {
      success: true,
      successCount: successCount,
      rejectedCount: rejectedCount,
      total: validOrders.length,
    };
  } catch (error) {
    Logger.log('❌ 重建日曆失敗:', error);
    return { success: false, error: error.message };
  }
}

function clearCalendarsInternal() {
  try {
    Logger.log('🗑️ 開始清空日曆...');

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear - 3, 0, 1);
    const endDate = new Date(currentYear + 3, 11, 31);

    const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
    const publicEvents = publicCal.getEvents(startDate, endDate);
    publicEvents.forEach((event) => event.deleteEvent());

    const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
    const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);
    housekeepingEvents.forEach((event) => event.deleteEvent());

    const totalDeleted = publicEvents.length + housekeepingEvents.length;

    Logger.log('✅ 清空完成：共刪除 ' + totalDeleted + ' 個事件');

    return {
      success: true,
      deletedCount: totalDeleted,
    };
  } catch (error) {
    Logger.log('❌ 清空日曆失敗:', error);
    return { success: false, error: error.message };
  }
}

function cleanupOldYearInternal() {
  try {
    return CalendarManager.cleanupOldYearEvents();
  } catch (error) {
    Logger.log('❌ 清理去年事件失敗:', error);
    return { success: false, error: error.message };
  }
}

// 觸發器入口：每天凌晨 3am 清理去年日曆事件
function cleanupOldYearEvents() {
  return CalendarManager.cleanupOldYearEvents();
}

/**
 * 財務報表：依年度（可選月份）彙總
 * @param {number} year - 年份
 * @param {number} [month] - 0 或省略＝全年；1–12＝只算該月入住的訂單
 */
function getFinanceStatsInternal(year, month) {
  try {
    const orders = DataStore.getOrders(null, year);
    let revenueOrders = orders.filter((o) => o.status === '完成' || o.status === '已付訂');
    if (month && month >= 1 && month <= 12) {
      revenueOrders = revenueOrders.filter((o) => {
        if (!o.checkIn) return false;
        const m = new Date(o.checkIn).getMonth() + 1;
        return m === month;
      });
    }
    let revenue = 0;
    let totalDeposit = 0;
    let totalBalance = 0;
    let totalDiscount = 0;
    let orderCount = 0;
    let returningCount = 0;
    let addonTotal = 0;
    let extraIncomeTotal = 0;
    revenueOrders.forEach((o) => {
      revenue += Number(o.totalPrice) || 0;
      totalDeposit += Number(o.paidDeposit) || 0;
      totalBalance += Number(o.remainingBalance) || 0;
      totalDiscount += Number(o.discountAmount) || 0;
      addonTotal += Number(o.addonAmount) || 0;
      extraIncomeTotal += Number(o.extraIncome) || 0;
      orderCount += 1;
      if (o.isReturningGuest) returningCount += 1;
    });
    const costOrderIDs = {};
    revenueOrders.forEach((o) => {
      costOrderIDs[String(o.orderID)] = true;
    });
    const costs = DataStore.getCostRows(year);
    let rebateTotal = 0;
    let complimentaryTotal = 0;
    let otherCostTotal = 0;
    let addonCostTotal = 0;
    costs.forEach((r) => {
      if (!costOrderIDs[String(r.orderID)]) return;
      rebateTotal += Number(r.rebateAmount) || 0;
      complimentaryTotal += Number(r.complimentaryAmount) || 0;
      otherCostTotal += Number(r.otherCost) || 0;
      addonCostTotal += Number(r.addonCost) || 0;
    });
    const costTotal = rebateTotal + complimentaryTotal + otherCostTotal;
    // 行程佣金 = 代訂代收 - 旅行社費用，計入淨利
    const addonCommission = addonTotal - addonCostTotal;

    // 月固定支出
    const monthlyExpenseRows = DataStore.getMonthlyExpenseRows(year);
    const MONTHLY_FIELDS = ['laundry','water','electricity','internet','platformFee','landTax','insurance','other'];
    let monthlyExpenseTotal = 0;
    let monthlyExpenseBreakdown = {};
    MONTHLY_FIELDS.forEach(f => { monthlyExpenseBreakdown[f] = 0; });
    monthlyExpenseRows.forEach(r => {
      if (month && month >= 1 && month <= 12) {
        const ym = String(r.yearMonth || '');
        const rowMonth = parseInt(ym.split('-')[1], 10);
        if (rowMonth !== month) return;
      }
      MONTHLY_FIELDS.forEach(f => {
        const v = Number(r[f]) || 0;
        monthlyExpenseTotal += v;
        monthlyExpenseBreakdown[f] = (monthlyExpenseBreakdown[f] || 0) + v;
      });
    });

    const netIncome = revenue + extraIncomeTotal + addonCommission - costTotal - monthlyExpenseTotal;
    return {
      success: true,
      year: year,
      month: month || null,
      revenue: revenue,
      totalDeposit: totalDeposit,
      totalBalance: totalBalance,
      totalDiscount: totalDiscount,
      addonTotal: addonTotal,
      addonCostTotal: addonCostTotal,
      addonCommission: addonCommission,
      extraIncomeTotal: extraIncomeTotal,
      orderCount: orderCount,
      returningCount: returningCount,
      rebateTotal: rebateTotal,
      complimentaryTotal: complimentaryTotal,
      otherCostTotal: otherCostTotal,
      costTotal: costTotal,
      monthlyExpenseTotal: monthlyExpenseTotal,
      monthlyExpenseBreakdown: monthlyExpenseBreakdown,
      netIncome: netIncome,
    };
  } catch (error) {
    Logger.log('❌ getFinanceStats 錯誤:', error);
    return { success: false, error: error.message };
  }
}

function getCostForOrderInternal(orderID, year) {
  try {
    const cost = DataStore.getCostByOrderID(orderID, year || new Date().getFullYear());
    return { success: true, cost: cost };
  } catch (e) {
    Logger.log('❌ getCostForOrder 錯誤:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 詳細財務報表：可選月份；含完整摘要、分月、同業退佣、訂單明細
 * 淨利 = 房間營收 + 其他收入 + 行程佣金（代訂代收 - 旅行社費用）- 退佣 - 招待 - 其他支出
 * @param {number} year
 * @param {number} [month] - 0 或省略＝全年；1–12＝只回該月
 */
function getDetailedFinanceReportInternal(year, month) {
  try {
    const y = year || new Date().getFullYear();
    const orders = DataStore.getOrders(null, y);
    let revenueOrders = orders.filter((o) => o.status === '完成' || o.status === '已付訂');
    if (month && month >= 1 && month <= 12) {
      revenueOrders = revenueOrders.filter((o) => {
        if (!o.checkIn) return false;
        return new Date(o.checkIn).getMonth() + 1 === month;
      });
    }
    const costs = DataStore.getCostRows(y);
    const costByOrderID = {};
    costs.forEach((r) => {
      costByOrderID[String(r.orderID)] = r;
    });

    const monthly = {};
    const byAgency = {};
    let summary = {
      revenue: 0,
      totalDeposit: 0,
      totalBalance: 0,
      totalDiscount: 0,
      returningCount: 0,
      addonTotal: 0,
      addonCostTotal: 0,
      extraIncomeTotal: 0,
      rebateTotal: 0,
      complimentaryTotal: 0,
      otherCostTotal: 0,
    };

    revenueOrders.forEach((o) => {
      const checkIn = o.checkIn ? new Date(o.checkIn) : new Date();
      const monthKey =
        checkIn.getFullYear() + '-' + String(checkIn.getMonth() + 1).padStart(2, '0');
      if (!monthly[monthKey]) {
        monthly[monthKey] = {
          month: monthKey,
          revenue: 0,
          totalDeposit: 0,
          totalBalance: 0,
          totalDiscount: 0,
          addonTotal: 0,
          addonCostTotal: 0,
          extraIncomeTotal: 0,
          rebateTotal: 0,
          complimentaryTotal: 0,
          otherCostTotal: 0,
        };
      }
      const rev = Number(o.totalPrice) || 0;
      const disc = Number(o.discountAmount) || 0;
      const addon = Number(o.addonAmount) || 0;
      const extra = Number(o.extraIncome) || 0;
      summary.revenue += rev;
      summary.totalDeposit += Number(o.paidDeposit) || 0;
      summary.totalBalance += Number(o.remainingBalance) || 0;
      summary.totalDiscount += disc;
      if (o.isReturningGuest) summary.returningCount += 1;
      summary.addonTotal += addon;
      summary.extraIncomeTotal += extra;
      monthly[monthKey].revenue += rev;
      monthly[monthKey].totalDeposit += Number(o.paidDeposit) || 0;
      monthly[monthKey].totalBalance += Number(o.remainingBalance) || 0;
      monthly[monthKey].totalDiscount += disc;
      monthly[monthKey].addonTotal += addon;
      monthly[monthKey].extraIncomeTotal += extra;
      const c = costByOrderID[String(o.orderID)];
      if (c) {
        const rb = Number(c.rebateAmount) || 0;
        const comp = Number(c.complimentaryAmount) || 0;
        const other = Number(c.otherCost) || 0;
        const ac = Number(c.addonCost) || 0;
        summary.rebateTotal += rb;
        summary.complimentaryTotal += comp;
        summary.otherCostTotal += other;
        summary.addonCostTotal += ac;
        monthly[monthKey].rebateTotal += rb;
        monthly[monthKey].complimentaryTotal += comp;
        monthly[monthKey].otherCostTotal += other;
        monthly[monthKey].addonCostTotal += ac;
      }
      const agency = (o.agencyName || '').trim() || '直客';
      if (!byAgency[agency])
        byAgency[agency] = { agencyName: agency, totalRebate: 0, orderCount: 0 };
      byAgency[agency].orderCount += 1;
      if (c) byAgency[agency].totalRebate += Number(c.rebateAmount) || 0;
    });

    summary.costTotal = summary.rebateTotal + summary.complimentaryTotal + summary.otherCostTotal;
    summary.addonCommission = summary.addonTotal - summary.addonCostTotal;
    summary.netIncome = summary.revenue + summary.extraIncomeTotal + summary.addonCommission - summary.costTotal;
    summary.orderCount = revenueOrders.length;

    const monthlyList = Object.keys(monthly)
      .sort()
      .map((k) => {
        const m = monthly[k];
        const costTotal = m.rebateTotal + m.complimentaryTotal + m.otherCostTotal;
        const addonCommission = m.addonTotal - m.addonCostTotal;
        const netIncome = m.revenue + m.extraIncomeTotal + addonCommission - costTotal;
        return { ...m, costTotal, addonCommission, netIncome };
      });

    const byAgencyList = Object.keys(byAgency).map((k) => byAgency[k]);

    const ordersWithCost = revenueOrders.map((o) => {
      const c = costByOrderID[String(o.orderID)] || {};
      return {
        ...o,
        rebateAmount: c.rebateAmount != null ? c.rebateAmount : 0,
        complimentaryAmount: c.complimentaryAmount != null ? c.complimentaryAmount : 0,
        otherCost: c.otherCost != null ? c.otherCost : 0,
        addonCost: c.addonCost != null ? c.addonCost : 0,
        costNote: c.note != null ? c.note : '',
      };
    });

    return {
      success: true,
      year: y,
      month: month || null,
      summary: summary,
      monthly: monthlyList,
      byAgency: byAgencyList,
      orders: ordersWithCost,
    };
  } catch (error) {
    Logger.log('❌ getDetailedFinanceReport 錯誤:', error);
    return { success: false, error: error.message };
  }
}

function saveCouponInternal(coupon) {
  if (!coupon || !coupon.code) {
    return { success: false, error: '折扣碼代碼不可為空' };
  }
  return DataStore.saveCoupon(coupon);
}

/**
 * ================================
 * Admin 專用：給 google.script.run 呼叫的入口
 * ================================
 * 後台日曆／列表用：直接讀取當年訂單表的原始資料，
 * 按表頭欄位名稱組成物件，避免 Schema 不一致時整批讀不到。
 */
function adminGetAllOrders() {
  try {
    const sheetName = DataStore.getCurrentSheetName();
    // 與 getOrders 相同：觸發 ensureOrderSheetSchema（補 housekeepingNote 等），避免後台讀到錯欄、寫入被跳過
    const sheet = DataStore.ensureYearSheetExists(sheetName);

    const data = sheet.getDataRange().getValues();
    if (!data || data.length <= 1) return [];

    const headerRow = data[0].map(function (h) {
      return String(h || '').trim();
    });

    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // 全空列略過
      if (!row || row.every(function (c) { return c === '' || c === null; })) continue;

      const obj = {};
      headerRow.forEach(function (key, idx) {
        if (!key) return;
        obj[key] = row[idx];
      });
      orders.push(obj);
    }

    // 強制轉為純 JSON，避免 GAS 在遇到日期/特殊型別時序列化失敗
    return JSON.parse(JSON.stringify(orders));
  } catch (e) {
    Logger.log('❌ adminGetAllOrders 錯誤:', e);
    return [];
  }
}

function adminCreateBooking(data) {
  // 後台人工建立，不需要 reCAPTCHA
  return BookingService.handleCreateOrder(data);
}

function adminUpdateOrderAndSync(orderID, updates) {
  return updateOrderAndSyncInternal(orderID, updates);
}

function adminGenerateNotification(orderID, changeType) {
  const order = DataStore.getOrderByID(orderID);
  if (!order) {
    return { success: false, error: '找不到訂單' };
  }
  return {
    success: true,
    lineText: generateLineNotification(order, changeType || '訂單更新'),
    hasEmail: !!order.email,
  };
}

function adminSendNotificationEmail(orderID) {
  return sendNotificationEmailInternal(orderID);
}

function adminMarkCompletedOrders() {
  return markCompletedOrdersInternal();
}

function adminGetCalendarStats() {
  const stats = CalendarManager.getCalendarStats();
  return {
    success: true,
    ...stats,
  };
}

function adminGetAllAgencyData() {
  return adminGetAllAgencyData_();
}

function adminRebuildCalendars() {
  return rebuildCalendarsInternal();
}

function adminClearCalendars() {
  return clearCalendarsInternal();
}

function adminCleanupOldYear() {
  return cleanupOldYearInternal();
}

function adminSendPostStayThankyouBatch() {
  return sendPostStayThankyouBatch();
}

function adminGetPostStayThankyouText(orderID) {
  return getPostStayThankyouText(orderID);
}

function adminGetFinanceStats(year, month) {
  const y = year || new Date().getFullYear();
  const m = month != null ? Number(month) : 0;
  return getFinanceStatsInternal(y, m === 0 ? undefined : m);
}

function adminGetCostForOrder(orderID, year) {
  return getCostForOrderInternal(orderID, year != null ? year : new Date().getFullYear());
}

function adminGetDetailedFinanceReport(year, month) {
  const y = year || new Date().getFullYear();
  const m = month != null ? Number(month) : 0;
  return getDetailedFinanceReportInternal(y, m === 0 ? undefined : m);
}

function adminGetCoupons() {
  return DataStore.getCoupons();
}

function adminSaveCoupon(coupon) {
  return saveCouponInternal(coupon);
}

function getMonthlyExpense(data) {
  try {
    const yearMonth = String(data && data.yearMonth || '').trim();
    if (!yearMonth) return { success: false, error: '缺少 yearMonth' };
    const row = DataStore.getMonthlyExpense(yearMonth);
    return { success: true, expense: row };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function saveMonthlyExpense(data) {
  try {
    const yearMonth = String(data && data.yearMonth || '').trim();
    if (!yearMonth) return { success: false, error: '缺少 yearMonth' };
    return DataStore.saveMonthlyExpense(yearMonth, data);
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 後台「系統設定」用：一鍵執行日常初始化（建表／補欄、觸發器、狀態統一）
 */
function adminRunSetupSystem() {
  try {
    if (typeof setupSystem !== 'function') {
      return { success: false, error: 'setupSystem 未載入，請確認 setup.js 已加入專案' };
    }
    setupSystem();
    return { success: true, message: '日常初始化已完成' };
  } catch (e) {
    Logger.log('adminRunSetupSystem 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「系統設定」用：建立或補齊指定年份訂單表
 */
function adminInitializeYearSheet(year) {
  try {
    if (typeof initializeYearSheet !== 'function') {
      return { success: false, error: 'initializeYearSheet 未載入，請確認 setup.js 已加入專案' };
    }
    initializeYearSheet(year || new Date().getFullYear());
    return { success: true, message: '訂單表已建立或已補齊欄位' };
  } catch (e) {
    Logger.log('adminInitializeYearSheet 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「系統設定」用：檢查系統狀態（Properties、日曆、觸發器、工作表），回傳 JSON 供畫面顯示
 */
function adminQuickCheck() {
  try {
    const props = PropertiesService.getScriptProperties();
    const propKeys = [
      'SHEET_ID',
      'RECAPTCHA_SECRET',
      'PUBLIC_CALENDAR_ID',
      'HOUSEKEEPING_CALENDAR_ID',
    ];
    const properties = {};
    propKeys.forEach(function (k) {
      properties[k] = !!props.getProperty(k);
    });

    let calendars = { public: false, housekeeping: false };
    try {
      if (typeof Config !== 'undefined' && Config.PUBLIC_CALENDAR_ID) {
        CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
        calendars.public = true;
      }
    } catch (e) {}
    try {
      if (typeof Config !== 'undefined' && Config.HOUSEKEEPING_CALENDAR_ID) {
        CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
        calendars.housekeeping = true;
      }
    } catch (e) {}

    const triggers = ScriptApp.getProjectTriggers().map(function (t) {
      return {
        handler: t.getHandlerFunction(),
        type: (t.getEventType() && t.getEventType().toString()) || '',
      };
    });

    let sheets = [];
    try {
      const ss = DataStore.getDB();
      const allSheets = ss.getSheets();
      for (var i = 0; i < allSheets.length; i++) {
        var s = allSheets[i];
        sheets.push({ name: s.getName(), rows: s.getLastRow() || 0 });
      }
    } catch (e) {
      sheets = [{ name: '(錯誤)', rows: 0, error: (e && e.message) || String(e) }];
    }

    return {
      success: true,
      properties: properties,
      calendars: calendars,
      triggers: triggers,
      sheets: sheets,
    };
  } catch (e) {
    Logger.log('adminQuickCheck 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「設定」：取得可編輯的 Script Properties（機密欄位僅回傳遮罩）
 */
function adminGetSettings() {
  try {
    const props = PropertiesService.getScriptProperties();
    const settings = (typeof SETTINGS_WHITELIST !== 'undefined' ? SETTINGS_WHITELIST : []).map(
      function (item) {
        const raw = props.getProperty(item.key);
        let value = '';
        if (item.isSecret) {
          value = raw ? '••••••••' : '未設定';
        } else {
          value = raw ? String(raw).trim() : '';
        }
        return { key: item.key, label: item.label, value: value, isSecret: !!item.isSecret };
      }
    );
    return { success: true, settings: settings };
  } catch (e) {
    Logger.log('adminGetSettings 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「設定」：寫入 Script Properties（僅接受白名單內的 key）
 */
function adminSetSettings(updates) {
  if (!updates || typeof updates !== 'object') {
    return { success: false, error: '請提供 updates 物件' };
  }
  const allowedKeys = (typeof SETTINGS_WHITELIST !== 'undefined' ? SETTINGS_WHITELIST : []).map(
    function (item) {
      return item.key;
    }
  );
  const props = PropertiesService.getScriptProperties();
  const updated = [];
  for (var key in updates) {
    if (allowedKeys.indexOf(key) === -1) continue;
    var value = updates[key];
    if (value === null || value === undefined) value = '';
    props.setProperty(key, String(value).trim());
    updated.push(key);
  }
  return {
    success: true,
    updated: updated,
    message: updated.length ? '已儲存 ' + updated.length + ' 項設定' : '無變更',
  };
}

/**
 * 臨時測試：檢查 DataStore.getOrders() 回傳格式
 * （用於 debug google.script.run callback 沒觸發的問題）
 */
function testOrdersFormat() {
  var orders = DataStore.getOrders();
  Logger.log('筆數: ' + orders.length);
  if (orders.length > 0) {
    Logger.log('第一筆 keys: ' + Object.keys(orders[0]).join(', '));
    try {
      Logger.log('第一筆 JSON: ' + JSON.stringify(orders[0]));
    } catch (e) {
      Logger.log('第一筆 JSON.stringify 失敗: ' + e.message);
    }
  }
}

/**
 * 測試 API 端點（開發用）
 */
function testDoGet() {
  const mockEvent = {
    parameter: {},
  };

  const response = doGet(mockEvent);
  const content = response.getContent();

  Logger.log('=== API 健康檢查測試 ===');
  Logger.log(content);
  Logger.log('');

  const parsed = JSON.parse(content);

  if (parsed.status === 'Alive') {
    Logger.log('✅ API 運作正常');
    Logger.log('');
    Logger.log('可用端點：');
    Logger.log('  - Admin 後台: ' + ScriptApp.getService().getUrl() + '?page=admin');
    Logger.log('  - 房務介面: ' + ScriptApp.getService().getUrl() + '?page=housekeeping');
    Logger.log('  - 公開日曆: ' + ScriptApp.getService().getUrl() + '?action=getBookedDates');
    Logger.log('  - 日曆統計: ' + ScriptApp.getService().getUrl() + '?action=getCalendarStats');
  } else {
    Logger.log('❌ API 異常');
  }
}

/**
 * 測試日曆管理 API（開發用）
 */
function testCalendarAPIs() {
  Logger.log('=== 測試日曆管理 API ===');
  Logger.log('');

  // 測試 1: 日曆統計
  Logger.log('📊 測試 1: 日曆統計');
  try {
    const stats = CalendarManager.getCalendarStats();
    Logger.log(`✅ 公開日曆: ${stats.publicCount} 個事件`);
    Logger.log(`✅ 房務日曆: ${stats.housekeepingCount} 個事件`);
  } catch (error) {
    Logger.log('❌ 日曆統計失敗:', error.message);
  }

  Logger.log('');
  Logger.log('✅ 測試完成');
}
