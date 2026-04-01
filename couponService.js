/**
 * 折扣碼服務：驗證優惠碼、計算折抵金額
 * 支援：內建碼（可加年度後綴）、試算表自訂碼、使用次數、有效期限、類型 fixed | percent
 *
 * 內建碼（不分大小寫）：
 * - JUSTDROPINN / JUSTDROPINN2026：加 LINE 活動，每晚折抵 800（年度後綴可選，若填須為當年度）
 * - STILLDROPINN / STILLDROPINN2026：老客專屬，每晚折抵 500（年度後綴規則同上）
 */

function isBuiltinCouponCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  return /^(JUSTDROPINN|STILLDROPINN)(\d{4})?$/.test(normalized);
}

/**
 * @returns {{ amountPerNight: number, discountType: string, discountValue: number } | null}
 */
function resolveBuiltinCoupon_(code) {
  const normalized = String(code || '').trim().toUpperCase();
  const m = /^(JUSTDROPINN|STILLDROPINN)(\d{4})?$/.exec(normalized);
  if (!m) return null;
  const base = m[1];
  const yearSuffix = m[2];
  const currentYear = new Date().getFullYear();
  if (yearSuffix && Number(yearSuffix) !== currentYear) {
    return { _invalidYear: true };
  }
  const amountPerNight = base === 'JUSTDROPINN' ? 800 : 500;
  return {
    amountPerNight: amountPerNight,
    discountType: 'per_night_fixed',
    discountValue: amountPerNight,
  };
}

function checkCoupon(code, originalTotal, nights) {
  const n = Number(nights);
  const nightCount = n > 0 ? n : 1;

  if (!code || !originalTotal || originalTotal <= 0) {
    return { valid: false, message: '請輸入優惠碼並確認訂單金額' };
  }

  const builtin = resolveBuiltinCoupon_(code);
  if (builtin && builtin._invalidYear) {
    return { valid: false, message: '此年度優惠碼已失效，請使用本年度代碼' };
  }
  if (builtin && !builtin._invalidYear) {
    const raw = builtin.amountPerNight * nightCount;
    const discountAmount = Math.min(Math.round(raw), originalTotal);
    if (discountAmount <= 0) {
      return { valid: false, message: '此優惠碼不適用於本訂單' };
    }
    return {
      valid: true,
      discountAmount: discountAmount,
      discountType: builtin.discountType,
      discountValue: builtin.discountValue,
      description: '',
    };
  }

  const coupon = DataStore.getCouponByCode(code);
  if (!coupon) {
    return { valid: false, message: '優惠碼不存在或已失效' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (coupon.validFrom) {
    const from = new Date(coupon.validFrom);
    from.setHours(0, 0, 0, 0);
    if (today < from) {
      return { valid: false, message: '優惠碼尚未開始使用' };
    }
  }
  if (coupon.validTo) {
    const to = new Date(coupon.validTo);
    to.setHours(23, 59, 59, 999);
    if (today > to) {
      return { valid: false, message: '優惠碼已過期' };
    }
  }

  const useLimit = Number(coupon.useLimit);
  const usedCount = Number(coupon.usedCount) || 0;
  if (useLimit > 0 && usedCount >= useLimit) {
    return { valid: false, message: '優惠碼已達使用上限' };
  }

  const type = (coupon.type || 'fixed').toLowerCase();
  const value = Number(coupon.value) || 0;
  let discountAmount = 0;

  if (type === 'percent') {
    discountAmount = Math.round(originalTotal * (value / 100));
  } else {
    discountAmount = Math.min(value, originalTotal);
  }

  if (discountAmount <= 0) {
    return { valid: false, message: '此優惠碼不適用於本訂單' };
  }

  return {
    valid: true,
    discountAmount: discountAmount,
    discountType: type,
    discountValue: value,
    description: coupon.description || '',
  };
}
