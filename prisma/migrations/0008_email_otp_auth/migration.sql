ALTER TABLE "User" ADD COLUMN "email" TEXT;
ALTER TABLE "User" ADD COLUMN "accountTrack" TEXT;
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "PendingEmailAuth" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "accountTrack" TEXT NOT NULL,
    "linkUid" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingEmailAuth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PendingEmailAuth_email_key" ON "PendingEmailAuth"("email");
CREATE UNIQUE INDEX "PendingEmailAuth_handle_key" ON "PendingEmailAuth"("handle");
CREATE INDEX "PendingEmailAuth_expiresAt_idx" ON "PendingEmailAuth"("expiresAt");
