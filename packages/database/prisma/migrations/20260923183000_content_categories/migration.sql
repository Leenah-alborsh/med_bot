CREATE TABLE "ContentCategory" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContentItem" ADD COLUMN "contentCategoryId" UUID;
ALTER TABLE "StudentBotMembership" ADD COLUMN "navigationContentCategoryId" UUID;

INSERT INTO "ContentCategory" (
    "id", "sectionId", "nameAr", "nameEn", "displayOrder", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), s."id", 'عام', 'General', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Section" s
WHERE EXISTS (SELECT 1 FROM "ContentItem" c WHERE c."sectionId" = s."id");

UPDATE "ContentItem" c
SET "contentCategoryId" = category."id"
FROM "ContentCategory" category
WHERE category."sectionId" = c."sectionId" AND category."displayOrder" = 0;

ALTER TABLE "ContentItem" ALTER COLUMN "contentCategoryId" SET NOT NULL;

CREATE UNIQUE INDEX "ContentCategory_sectionId_displayOrder_key" ON "ContentCategory"("sectionId", "displayOrder");
CREATE INDEX "ContentCategory_sectionId_isActive_displayOrder_idx" ON "ContentCategory"("sectionId", "isActive", "displayOrder");
CREATE UNIQUE INDEX "ContentItem_contentCategoryId_displayOrder_key" ON "ContentItem"("contentCategoryId", "displayOrder");
DROP INDEX "ContentItem_sectionId_displayOrder_key";
CREATE INDEX "ContentItem_contentCategoryId_state_isActive_displayOrder_idx" ON "ContentItem"("contentCategoryId", "state", "isActive", "displayOrder");

ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_contentCategoryId_fkey" FOREIGN KEY ("contentCategoryId") REFERENCES "ContentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentBotMembership" ADD CONSTRAINT "StudentBotMembership_navigationContentCategoryId_fkey" FOREIGN KEY ("navigationContentCategoryId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;