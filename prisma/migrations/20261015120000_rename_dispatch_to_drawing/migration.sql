-- 「發文」改稱「提供圖說」（僅更新仍為系統預設文字者，使用者自訂之名稱不受影響）
UPDATE "DeadlineRule" SET "title" = '提供事前規劃及分析報告書圖說' WHERE "taskType" = 'PRE_REPORT_DISPATCH' AND "title" = '事前規劃及分析報告書發文掛件';
UPDATE "DeadlineRule" SET "description" = '機關通知日（D0）後第 12 個工作天提供圖說' WHERE "taskType" = 'PRE_REPORT_DISPATCH' AND "description" = '機關通知日（D0）後第 12 個工作天發文掛件';
UPDATE "DeadlineRule" SET "description" = '提供圖說前第 1 個工作天完成創稿' WHERE "taskType" = 'PRE_REPORT_DRAFT' AND "description" = '發文前第 1 個工作天完成創稿';
UPDATE "DeadlineRule" SET "title" = '提供審查會議後修正規劃圖說' WHERE "taskType" = 'REVIEW_DRAWING_DISPATCH' AND "title" = '正式發文提供審查會議後修正規劃圖說';
UPDATE "DeadlineRule" SET "title" = '提供會勘後修正規劃圖說' WHERE "taskType" = 'SITE_VISIT_DRAWING_DISPATCH' AND "title" = '正式發文提供會勘後修正規劃圖說';

UPDATE "Task" SET "title" = '提供事前規劃及分析報告書圖說' WHERE "taskType" = 'PRE_REPORT_DISPATCH' AND "title" = '事前規劃及分析報告書發文掛件';
UPDATE "Task" SET "description" = '機關通知日（D0）後第 12 個工作天提供圖說' WHERE "taskType" = 'PRE_REPORT_DISPATCH' AND "description" = '機關通知日（D0）後第 12 個工作天發文掛件';
UPDATE "Task" SET "description" = '提供圖說前第 1 個工作天完成創稿' WHERE "taskType" = 'PRE_REPORT_DRAFT' AND "description" = '發文前第 1 個工作天完成創稿';
UPDATE "Task" SET "title" = '提供審查會議後修正規劃圖說' WHERE "taskType" = 'REVIEW_DRAWING_DISPATCH' AND "title" = '正式發文提供審查會議後修正規劃圖說';
UPDATE "Task" SET "title" = '提供會勘後修正規劃圖說' WHERE "taskType" = 'SITE_VISIT_DRAWING_DISPATCH' AND "title" = '正式發文提供會勘後修正規劃圖說';
