-- 使用初始密碼之帳號需提醒變更密碼
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
