CREATE TABLE "TelegramWebhookUpdate" (
    "updateId" BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "TelegramWebhookUpdate_pkey" PRIMARY KEY ("updateId")
);

CREATE INDEX "TelegramWebhookUpdate_processedAt_receivedAt_idx"
ON "TelegramWebhookUpdate"("processedAt", "receivedAt");