-- 移除「提供事前規劃及分析報告書圖說」工項：停用期限規則、取消尚未完成的工作（已完成者保留紀錄）
UPDATE "DeadlineRule" SET "enabled" = false, "description" = '已停用：事前規劃報告書不另列提供圖說工項' WHERE "taskType" = 'PRE_REPORT_DISPATCH';
UPDATE "Task" SET "status" = 'CANCELLED' WHERE "taskType" = 'PRE_REPORT_DISPATCH' AND "status" IN ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD');
