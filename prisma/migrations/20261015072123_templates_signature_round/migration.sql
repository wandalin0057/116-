-- AlterTable
ALTER TABLE "EmailDraft" ADD COLUMN     "attachmentUrl" TEXT;

-- AlterTable
ALTER TABLE "SchoolCase" ADD COLUMN     "notificationRound" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailSignature" TEXT;
