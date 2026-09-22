ALTER TABLE "StudentBotMembership"
ADD COLUMN "navigationLevel" TEXT NOT NULL DEFAULT 'STAGE',
ADD COLUMN "navigationStage" INTEGER,
ADD COLUMN "navigationYearId" UUID,
ADD COLUMN "navigationSemesterId" UUID,
ADD COLUMN "navigationCourseId" UUID,
ADD COLUMN "navigationSectionId" UUID;

CREATE INDEX "StudentBotMembership_navigationLevel_idx"
ON "StudentBotMembership"("navigationLevel");