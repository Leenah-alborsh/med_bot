CREATE INDEX "ContentAttachment_storageChatId_storageMessageId_idx" ON "ContentAttachment"("storageChatId", "storageMessageId");

CREATE TYPE "TelegramInboxStatus" AS ENUM ('UNCLASSIFIED', 'CLASSIFIED');

CREATE TABLE "TelegramChannelFile" (
  "id" UUID NOT NULL,
  "storageChatId" BIGINT NOT NULL,
  "storageMessageId" INTEGER NOT NULL,
  "telegramFileId" TEXT NOT NULL,
  "telegramFileUniqueId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" BIGINT NOT NULL,
  "mediaType" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "status" "TelegramInboxStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
  "contentItemId" UUID,
  "attachmentId" UUID,
  "classifiedById" UUID,
  "classifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TelegramChannelFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramChannelFile_storageChatId_storageMessageId_key" ON "TelegramChannelFile"("storageChatId", "storageMessageId");
CREATE UNIQUE INDEX "TelegramChannelFile_contentItemId_key" ON "TelegramChannelFile"("contentItemId");
CREATE UNIQUE INDEX "TelegramChannelFile_attachmentId_key" ON "TelegramChannelFile"("attachmentId");
CREATE INDEX "TelegramChannelFile_status_receivedAt_idx" ON "TelegramChannelFile"("status", "receivedAt");
CREATE INDEX "TelegramChannelFile_telegramFileUniqueId_idx" ON "TelegramChannelFile"("telegramFileUniqueId");

ALTER TABLE "TelegramChannelFile" ADD CONSTRAINT "TelegramChannelFile_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramChannelFile" ADD CONSTRAINT "TelegramChannelFile_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ContentAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TelegramChannelFile" ADD CONSTRAINT "TelegramChannelFile_classifiedById_fkey" FOREIGN KEY ("classifiedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;