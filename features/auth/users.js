// 純前端示範帳號。正式環境請改用 Firebase Auth / Supabase Auth / 後端 API。
window.APP_USERS = [
  { username: "admin", password: "admin123", displayName: "管理員", role: "admin" },
  { username: "staff", password: "staff123", displayName: "一般人員", role: "staff" }
];
window.ROLE_LABELS = { admin: "管理員｜可刪除物品與清空紀錄", staff: "一般人員｜不可刪除紀錄" };
