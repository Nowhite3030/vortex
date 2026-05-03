# Vortex GitHub Pages 倉庫管理系統

## 預設帳號
- admin / admin123：管理員，可刪除物品與清空紀錄
- staff / staff123：一般人員，可新增、提取、補充，但不能刪除物品與清空紀錄

## 資料夾架構
- assets/css：共用紫羅蘭主題
- shared/js：共用頁面切換邏輯
- features/auth：帳密與身分組
- features/warehouse：倉庫功能
- features/public-funds：公費功能預留資料夾
- features/live-map：活點地圖功能預留資料夾

## 重要提醒
此版本是 GitHub Pages 可用的純前端示範版，帳密資料寫在前端檔案中，不能拿來保護真正機密資料。正式使用請接 Firebase Auth、Supabase Auth 或後端 API。
