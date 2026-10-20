-- Co-team seats + room-bound help requests
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "roomId" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "pendingIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "HelpRequest" ADD COLUMN IF NOT EXISTS "acceptedIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "HelpRequest_roomId_status_idx" ON "HelpRequest"("roomId", "status");
