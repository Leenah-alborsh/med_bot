-- Phase 2 secure administrator authentication and authorization.
ALTER TYPE "AdminStatus" RENAME VALUE 'INVITED' TO 'PENDING';
ALTER TYPE "AdminStatus" RENAME VALUE 'SUSPENDED' TO 'DISABLED';

CREATE TYPE "AdminSetupTokenPurpose" AS ENUM ('ACCOUNT_SETUP', 'PASSWORD_RESET');

ALTER TABLE "AdminUser"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

ALTER TABLE "Role"
  ADD COLUMN "nameAr" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "nameEn" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Role" SET "nameAr" = "name", "nameEn" = "name";
ALTER TABLE "Role" ALTER COLUMN "nameAr" DROP DEFAULT, ALTER COLUMN "nameEn" DROP DEFAULT;

ALTER TABLE "Permission"
  ADD COLUMN "labelAr" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "labelEn" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "isReserved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Permission" SET "labelAr" = "key", "labelEn" = "key";
ALTER TABLE "Permission" ALTER COLUMN "labelAr" DROP DEFAULT, ALTER COLUMN "labelEn" DROP DEFAULT;

CREATE TABLE "AdminSession" (
  "id" UUID NOT NULL,
  "adminUserId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "csrfHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSetupToken" (
  "id" UUID NOT NULL,
  "adminUserId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" "AdminSetupTokenPurpose" NOT NULL DEFAULT 'ACCOUNT_SETUP',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_adminUserId_expiresAt_idx" ON "AdminSession"("adminUserId", "expiresAt");
CREATE INDEX "AdminSession_expiresAt_revokedAt_idx" ON "AdminSession"("expiresAt", "revokedAt");
CREATE UNIQUE INDEX "AdminSetupToken_tokenHash_key" ON "AdminSetupToken"("tokenHash");
CREATE INDEX "AdminSetupToken_adminUserId_purpose_expiresAt_idx" ON "AdminSetupToken"("adminUserId", "purpose", "expiresAt");
CREATE INDEX "Student_firstSeenAt_idx" ON "Student"("firstSeenAt");
CREATE INDEX "Student_lastSeenAt_idx" ON "Student"("lastSeenAt");
CREATE INDEX "StudentBotMembership_lastInteraction_idx" ON "StudentBotMembership"("lastInteraction");

ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSetupToken" ADD CONSTRAINT "AdminSetupToken_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminRole" DROP CONSTRAINT "AdminRole_roleId_fkey";
ALTER TABLE "AdminRole" ADD CONSTRAINT "AdminRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "AdminUser" SET "email" = LOWER(TRIM("email"));
CREATE UNIQUE INDEX "AdminUser_email_normalized_key" ON "AdminUser"(LOWER("email"));
