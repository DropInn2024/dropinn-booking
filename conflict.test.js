const { isConflict } = require('./bookingService');

describe('雫旅 DROP INN 訂單衝突檢查', () => {
  test('應該檢測到日期衝突', () => {
    // 模擬已存在的訂單
    const existingOrders = [
      {
        orderID: 'DROP-TEST',
        checkIn: '2026-04-22',
        checkOut: '2026-04-24',
        status: '已付訂',
      },
    ];

    // 嘗試預訂撞期的日期
    const newBooking = {
      checkIn: '2026-04-23',
      checkOut: '2026-04-25',
    };

    const conflict = isConflict(newBooking, existingOrders);

    expect(conflict).toBe(true);
  });

  test('沒有衝突的日期應該通過', () => {
    const existingOrders = [{ checkIn: '2026-04-22', checkOut: '2026-04-24' }];

    const newBooking = {
      checkIn: '2026-04-25', // 不重疊
      checkOut: '2026-04-27',
    };

    const conflict = isConflict(newBooking, existingOrders);

    expect(conflict).toBe(false);
  });
});
