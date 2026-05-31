/** 快速回傳 JSON Response */
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/** 將 YYYY-MM-DD / YYYY/M/D 等格式正規化為 YYYY-MM-DD（補零） */
export function normalizeDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
