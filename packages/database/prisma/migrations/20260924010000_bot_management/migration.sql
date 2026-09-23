ALTER TABLE "Bot"
  ADD COLUMN "welcomeMessage" TEXT,
  ADD COLUMN "welcomePhotoFileId" TEXT;

CREATE TYPE "AnnouncementStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "Announcement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "botId" UUID NOT NULL,
  "createdById" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "photoFileId" TEXT,
  "targetYearIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'QUEUED',
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Announcement_status_createdAt_idx" ON "Announcement"("status", "createdAt");
CREATE INDEX "Announcement_botId_createdAt_idx" ON "Announcement"("botId", "createdAt");
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;