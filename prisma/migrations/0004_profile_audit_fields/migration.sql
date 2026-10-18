DO $$ BEGIN
  CREATE TYPE "UpdateKind" AS ENUM ('MILESTONE', 'DEAD_END', 'DECISION', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "updateKind" "UpdateKind" DEFAULT 'MILESTONE';
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "promptUsed" TEXT;
ALTER TABLE "JourneyNode" ADD COLUMN IF NOT EXISTS "tools" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Contribution" ADD COLUMN IF NOT EXISTS "markedHelpful" BOOLEAN DEFAULT false;
ALTER TABLE "Contribution" ADD COLUMN IF NOT EXISTS "markedHelpfulAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Contribution_markedHelpful_userId_idx" ON "Contribution"("markedHelpful", "userId");

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "SessionShip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT,
  "nodeId" TEXT,
  "dayKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionShip_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SessionShip_userId_dayKey_idx" ON "SessionShip"("userId", "dayKey");
CREATE INDEX IF NOT EXISTS "SessionShip_userId_createdAt_idx" ON "SessionShip"("userId", "createdAt");
