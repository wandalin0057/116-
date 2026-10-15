-- 「寄送審查簡報」改稱「提供審查簡報」（僅更新仍為系統預設文字者）
UPDATE "DeadlineRule" SET "title" = '提供審查簡報' WHERE "taskType" = 'REVIEW_SLIDES_EMAIL' AND "title" = '寄送審查簡報給機關';
UPDATE "DeadlineRule" SET "description" = '審查會議前第 2 個工作天提供簡報' WHERE "taskType" = 'REVIEW_SLIDES_EMAIL' AND "description" = '審查會議前第 2 個工作天寄送簡報';
UPDATE "Task" SET "title" = '提供審查簡報' WHERE "taskType" = 'REVIEW_SLIDES_EMAIL' AND "title" = '寄送審查簡報給機關';
UPDATE "Task" SET "description" = '審查會議前第 2 個工作天提供簡報' WHERE "taskType" = 'REVIEW_SLIDES_EMAIL' AND "description" = '審查會議前第 2 個工作天寄送簡報';
