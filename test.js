function adminGetAllOrders() {
  var orders = DataStore.getOrders();
  // 強制序列化再回傳，避免 google.script.run 傳 null
  return JSON.parse(JSON.stringify(orders));
}