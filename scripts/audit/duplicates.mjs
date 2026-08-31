#!/usr/bin/env node
/**
 * 重複資料稽核（npm run audit:dups）
 * ------------------------------------------------------------
 * 起因：2026-08 王于瑄房務費被算兩次、多付 2,400。
 * 程式是「先 SELECT 再決定 INSERT / UPDATE」，兩個請求相隔 18 毫秒
 * 同時進來時，都在對方寫入前查到「沒有」，於是各插一筆。
 *
 * 這個檔做兩件事：
 *   1. 靜態掃描：找出還在用「先查再寫」的程式碼（危險寫法）
 *   2. 資料掃描：對正式 D1 跑一輪重複檢查（--remote 時）
 *
 * 只靠程式紀律擋不住這種錯 —— 真正的保證是資料庫的唯一索引。
 * 所以這裡也會列出「該唯一卻沒有唯一索引」的表。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const REMOTE = process.argv.includes('--remote');

/* ── 1. 靜態掃描：先查再寫 ──────────────────────────────── */
// 抓「查詢結果存進變數 → if (該變數) → 分支裡有 INSERT」的形狀。
// 這種寫法在兩個請求同時進來時會雙寫，除非資料表有唯一索引擋著。
function scanSource() {
  const hits = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.js')) continue;
      const src = readFileSync(p, 'utf8');
      const lines = src.split(/\r?\n/);
      lines.forEach((line, i) => {
        // const existing = await ... SELECT ...
        if (!/const\s+(\w*(?:existing|exists|found|dup)\w*)\s*=\s*await/i.test(line)) return;
        const varName = line.match(/const\s+(\w+)\s*=/)?.[1];
        if (!varName) return;
        // 視窗要夠長：先查再寫之間常隔著一段計算。太短會把已有
        // ON CONFLICT 保護的寫法誤報成危險（housekeeping_settlements 就是）。
        const window = lines.slice(i, i + 60).join('\n');
        if (!new RegExp(`if\\s*\\(\\s*!?${varName}`).test(window)) return;
        if (!/INSERT\s+INTO/i.test(window)) return;
        if (/ON\s+CONFLICT/i.test(window)) return;       // 已有 UPSERT 保護
        const table = window.match(/INSERT\s+INTO\s+([A-Za-z_]+)/i)?.[1] || '?';
        hits.push({ file: p.slice(ROOT.length).replace(/\\/g, '/'), line: i + 1, table });
      });
    }
  };
  walk(join(ROOT, 'worker', 'src'));
  return hits;
}

/* ── 2. 該唯一卻沒唯一索引的表 ──────────────────────────── */
// key = 邏輯上「一組只能有一列」的欄位組合
const SHOULD_BE_UNIQUE = [
  { table: 'housekeeping_costs', key: 'orderID',        why: '一張訂單一筆房務費' },
  { table: 'cost_rows',          key: 'orderID',        why: '一張訂單一列成本' },
  { table: 'drift_reviews',      key: 'spotId, userId', why: '一人對一景點一則' },
  { table: 'monthly_expenses',   key: 'yearMonth',      why: '一個月一列' },
  { table: 'vendor_contacts',    key: 'vendor',         why: '一家供應商一列' },
  { table: 'booking_locks',      key: 'date',           why: '一晚只能被一張訂單鎖住' },
];

/* ── 3. 資料掃描（--remote 才跑）────────────────────────── */
const DATA_CHECKS = [
  { name: '訂單 orderID',        sql: 'SELECT orderID FROM orders GROUP BY orderID HAVING COUNT(*)>1' },
  { name: '訂單成本',            sql: 'SELECT orderID FROM cost_rows GROUP BY orderID HAVING COUNT(*)>1' },
  { name: '房務費',              sql: 'SELECT orderID FROM housekeeping_costs GROUP BY orderID HAVING COUNT(*)>1' },
  { name: '月支出',              sql: 'SELECT yearMonth FROM monthly_expenses GROUP BY yearMonth HAVING COUNT(*)>1' },
  { name: '同人同日期重複訂單',  sql: "SELECT name FROM orders WHERE status<>'取消' GROUP BY name, phone, checkIn HAVING COUNT(*)>1" },
  { name: '同日同額重複雜支',    sql: 'SELECT date FROM misc_ledger GROUP BY date, amount, note HAVING COUNT(*)>1' },
  { name: '房務其他項目重複',    sql: 'SELECT monthKey FROM housekeeping_extras GROUP BY monthKey, description, amount HAVING COUNT(*)>1' },
];

function d1(sql) {
  const out = execSync(
    `npx wrangler@4.107.0 d1 execute dropinn-db --remote --json --command "${sql.replace(/"/g, "'")}"`,
    { cwd: join(ROOT, 'worker'), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
  ).replace(/\x1b\[[0-9;]*m/g, '');
  return JSON.parse(out.slice(out.search(/^\[\s*$/m)))[0].results || [];
}

/* ── 執行 ───────────────────────────────────────────────── */
console.log('重複資料稽核\n');

const risky = scanSource();

if (!REMOTE) {
  console.log(`【先查再寫】${risky.length} 處（需 --remote 才能判斷有沒有資料庫層保護）`);
  risky.forEach((h) => console.log(`  · ${h.file}:${h.line}  → INSERT INTO ${h.table}`));
}

if (REMOTE) {
  // 關鍵判斷：先查再寫本身不會壞資料 —— 只有當「危險寫法」碰上
  // 「該表沒有唯一性約束」時才會雙寫。房務費就是這個組合。
  // 兩者只中一個都算安全，所以要交叉比對，不然全是噪音。
  const master = d1("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL");
  const guarded = (table) => {
    const decl = String(master.find((m) => m.type === 'table' && m.name === table)?.sql || '');
    if (/\b(PRIMARY KEY|UNIQUE)\b/i.test(decl)) return true;
    return master.some((m) => m.type === 'index' && m.tbl_name === table && /UNIQUE/i.test(String(m.sql)));
  };

  const danger = risky.filter((h) => !guarded(h.table));
  const safe = risky.filter((h) => guarded(h.table));

  console.log(`【真正危險】先查再寫 ＋ 該表無唯一性約束：${danger.length} 處`);
  danger.forEach((h) => console.log(`  ⚠ ${h.file}:${h.line}  → ${h.table}（會雙寫）`));
  if (!danger.length) console.log('  ✓ 無');

  if (safe.length) {
    console.log(`\n【寫法不佳但安全】${safe.length} 處（資料庫層擋得住，競態只會回錯誤不會壞資料）`);
    safe.forEach((h) => console.log(`  · ${h.file}:${h.line}  → ${h.table}`));
  }

  console.log('\n【唯一索引】');
  const idx = d1("SELECT name, sql FROM sqlite_master WHERE type='index' AND sql LIKE '%UNIQUE%'")
    .map((r) => String(r.sql || ''));
  const tbl = d1("SELECT name, sql FROM sqlite_master WHERE type='table'");
  for (const s of SHOULD_BE_UNIQUE) {
    const cols = s.key.split(',').map((c) => c.trim());
    const inIndex = idx.some((q) => q.includes(`ON ${s.table}`) && cols.every((c) => q.includes(c)));
    const decl = String(tbl.find((t) => t.name === s.table)?.sql || '');
    const inTable = cols.length === 1
      && new RegExp(`${cols[0]}[^,]*\\b(UNIQUE|PRIMARY KEY)`, 'i').test(decl);
    console.log(`  ${inIndex || inTable ? '✓' : '⚠ 缺'} ${s.table}(${s.key})　${s.why}`);
  }

  console.log('\n【實際資料】');
  let bad = 0;
  for (const c of DATA_CHECKS) {
    const rows = d1(c.sql);
    if (rows.length) { bad++; console.log(`  ⚠ ${c.name}：${rows.length} 組重複`); }
    else console.log(`  ✓ ${c.name}`);
  }
  console.log(`\n---\n真正危險 ${danger.length} 處｜重複資料 ${bad} 項`);
  process.exit(danger.length || bad ? 1 : 0);
} else {
  console.log('\n（加 --remote 可一併掃正式資料庫）');
  process.exit(risky.length ? 1 : 0);
}
