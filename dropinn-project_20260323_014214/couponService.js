/**
 * 折扣碼服務：驗證優惠碼、計算折抵金額
 * 支援：使用次數、有效期限、類型 fixed | percent
 */

function checkCoupon(code, originalTotal) {
  if (!code || !originalTotal || originalTotal <= 0) {
    return { valid: false, message: '請輸入優惠碼並確認訂單金額' };
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
