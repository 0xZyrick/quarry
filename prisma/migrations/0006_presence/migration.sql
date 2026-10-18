
CREATE TABLE IF NOT EXISTS "RoomPresence" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "handle" TEXT,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoomPresence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RoomPresence_roomId_userId_key" ON "RoomPresence"("roomId", "userId");
CREATE INDEX IF NOT EXISTS "RoomPresence_roomId_lastSeenAt_idx" ON "RoomPresence"("roomId", "lastSeenAt");

ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "claimedById" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP(3);
