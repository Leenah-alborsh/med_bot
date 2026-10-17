CREATE TABLE "BotUsageEvent" (
    "id" UUID NOT NULL,
    "botMembershipId" UUID NOT NULL,
    "updateId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "isSessionStart" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BotUsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BotUsageEvent_botMembershipId_updateId_key" ON "BotUsageEvent"("botMembershipId", "updateId");
CREATE INDEX "BotUsageEvent_botMembershipId_createdAt_idx" ON "BotUsageEvent"("botMembershipId", "createdAt");
CREATE INDEX "BotUsageEvent_createdAt_isSessionStart_idx" ON "BotUsageEvent"("createdAt", "isSessionStart");
ALTER TABLE "BotUsageEvent" ADD CONSTRAINT "BotUsageEvent_botMembershipId_fkey" FOREIGN KEY ("botMembershipId") REFERENCES "StudentBotMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
