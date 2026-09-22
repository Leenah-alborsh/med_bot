ALTER TABLE "ContentAttachment"
  ADD COLUMN "telegramFileUniqueId" TEXT,
  ADD COLUMN "storageChatId" BIGINT,
  ADD COLUMN "storageMessageId" INTEGER,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "uploadedById" UUID;

ALTER TABLE "ContentAttachment"
  ADD CONSTRAINT "ContentAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContentAttachment_contentItemId_isCurrent_version_idx"
  ON "ContentAttachment"("contentItemId", "isCurrent", "version");
CREATE UNIQUE INDEX "ContentAttachment_contentItemId_checksum_key"
  ON "ContentAttachment"("contentItemId", "checksum");