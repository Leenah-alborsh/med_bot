-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('TEXT', 'LINK', 'FILE');

-- CreateEnum
CREATE TYPE "PublicationState" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'TELEGRAM', 'EXTERNAL_URL');

-- CreateEnum
CREATE TYPE "ContentAccessEventType" AS ENUM ('VIEW', 'OPEN_LINK', 'DOWNLOAD_REQUEST');

-- CreateEnum
CREATE TYPE "BrokenFileReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED');

-- Create the all-years bot and deliberately merge legacy relationships.
INSERT INTO "Bot" (
    "id", "key", "displayName", "tokenReference", "groupType", "status", "createdAt", "updatedAt"
)
VALUES (
    '00000000-0000-4000-8000-000000000003',
    'medical-main',
    'Medical Education Bot',
    'MEDICAL_BOT_TOKEN',
    'ALL_YEARS',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO UPDATE SET
    "displayName" = EXCLUDED."displayName",
    "tokenReference" = EXCLUDED."tokenReference",
    "groupType" = EXCLUDED."groupType",
    "status" = EXCLUDED."status",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "AcademicYearBot" ("id", "academicYearId", "botId", "createdAt")
SELECT gen_random_uuid(), y."id", b."id", CURRENT_TIMESTAMP
FROM "AcademicYear" y
CROSS JOIN "Bot" b
WHERE b."key" = 'medical-main'
ON CONFLICT ("academicYearId", "botId") DO NOTHING;

INSERT INTO "StudentBotMembership" (
    "id", "studentId", "botId", "firstSeenAt", "lastInteraction", "isBlocked", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    m."studentId",
    b."id",
    MIN(m."firstSeenAt"),
    MAX(m."lastInteraction"),
    BOOL_AND(m."isBlocked"),
    MIN(m."createdAt"),
    CURRENT_TIMESTAMP
FROM "StudentBotMembership" m
CROSS JOIN "Bot" b
WHERE b."key" = 'medical-main'
GROUP BY m."studentId", b."id"
ON CONFLICT ("studentId", "botId") DO NOTHING;

INSERT INTO "AdminScope" (
    "id", "adminUserId", "botId", "academicYearId", "courseId", "createdAt"
)
SELECT
    gen_random_uuid(),
    s."adminUserId",
    b."id",
    s."academicYearId",
    s."courseId",
    MIN(s."createdAt")
FROM "AdminScope" s
CROSS JOIN "Bot" b
WHERE s."botId" IN (SELECT "id" FROM "Bot" WHERE "key" IN ('preclinical', 'clinical'))
  AND b."key" = 'medical-main'
GROUP BY s."adminUserId", b."id", s."academicYearId", s."courseId"
ON CONFLICT ("adminUserId", "botId", "academicYearId", "courseId") DO NOTHING;

DELETE FROM "StudentBotMembership"
WHERE "botId" IN (SELECT "id" FROM "Bot" WHERE "key" IN ('preclinical', 'clinical'));

DELETE FROM "AcademicYearBot"
WHERE "botId" IN (SELECT "id" FROM "Bot" WHERE "key" IN ('preclinical', 'clinical'));

DELETE FROM "AdminScope"
WHERE "botId" IN (SELECT "id" FROM "Bot" WHERE "key" IN ('preclinical', 'clinical'));

UPDATE "Bot"
SET "status" = 'INACTIVE', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" IN ('preclinical', 'clinical');

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Semester" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "bodyText" TEXT,
    "contentType" "ContentType" NOT NULL,
    "state" "PublicationState" NOT NULL DEFAULT 'DRAFT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAttachment" (
    "id" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedPath" TEXT,
    "externalUrl" TEXT,
    "telegramFileId" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAccessEvent" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "botMembershipId" UUID,
    "eventType" "ContentAccessEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokenFileReport" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "attachmentId" UUID,
    "reasonCategory" TEXT,
    "status" "BrokenFileReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokenFileReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentItem_sectionId_state_isActive_displayOrder_idx" ON "ContentItem"("sectionId", "state", "isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "ContentItem_contentType_state_idx" ON "ContentItem"("contentType", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_sectionId_displayOrder_key" ON "ContentItem"("sectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ContentAttachment_contentItemId_storageProvider_idx" ON "ContentAttachment"("contentItemId", "storageProvider");

-- CreateIndex
CREATE INDEX "ContentAccessEvent_studentId_createdAt_idx" ON "ContentAccessEvent"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentAccessEvent_contentItemId_eventType_createdAt_idx" ON "ContentAccessEvent"("contentItemId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "BrokenFileReport_status_createdAt_idx" ON "BrokenFileReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BrokenFileReport_studentId_contentItemId_createdAt_idx" ON "BrokenFileReport"("studentId", "contentItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAttachment" ADD CONSTRAINT "ContentAttachment_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessEvent" ADD CONSTRAINT "ContentAccessEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessEvent" ADD CONSTRAINT "ContentAccessEvent_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAccessEvent" ADD CONSTRAINT "ContentAccessEvent_botMembershipId_fkey" FOREIGN KEY ("botMembershipId") REFERENCES "StudentBotMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokenFileReport" ADD CONSTRAINT "BrokenFileReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokenFileReport" ADD CONSTRAINT "BrokenFileReport_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokenFileReport" ADD CONSTRAINT "BrokenFileReport_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "ContentAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokenFileReport" ADD CONSTRAINT "BrokenFileReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
