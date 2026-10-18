-- Live embed + VOD archive fields on journey updates and work sessions

ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "liveUrl" TEXT;
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "livePlatform" TEXT;
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "vodUrl" TEXT;
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "sessionStartedAt" TIMESTAMP(3);
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "sessionEndedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JourneyNode_sessionEndedAt_idx" ON "JourneyNode"("sessionEndedAt");

ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "journeyNodeId" TEXT;
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "liveUrl" TEXT;
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "livePlatform" TEXT;
ALTER TABLE "WorkSession" ADD COLUMN IF NOT EXISTS "vodUrl" TEXT;

CREATE INDEX IF NOT EXISTS "WorkSession_journeyNodeId_idx" ON "WorkSession"("journeyNodeId");

DO $$ BEGIN
  ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_journeyNodeId_fkey"
    FOREIGN KEY ("journeyNodeId") REFERENCES "JourneyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
