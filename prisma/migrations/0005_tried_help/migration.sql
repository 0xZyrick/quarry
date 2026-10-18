
DO $$ BEGIN
  CREATE TYPE "TriedOutcome" AS ENUM ('DEAD_END', 'PARTIAL', 'WORKED', 'ARTIFACT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HelpRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "TriedAttempt" (
  "id" TEXT NOT NULL,
  "journeyNodeId" TEXT NOT NULL,
  "outcome" "TriedOutcome" NOT NULL,
  "detail" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TriedAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TriedAttempt_journeyNodeId_idx" ON "TriedAttempt"("journeyNodeId");
DO $$ BEGIN
  ALTER TABLE "TriedAttempt" ADD CONSTRAINT "TriedAttempt_journeyNodeId_fkey"
    FOREIGN KEY ("journeyNodeId") REFERENCES "JourneyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "HelpRequest" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "nodeId" TEXT,
  "creatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" "HelpRequestStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HelpRequest_projectId_status_idx" ON "HelpRequest"("projectId", "status");
CREATE INDEX IF NOT EXISTS "HelpRequest_status_createdAt_idx" ON "HelpRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "HelpRequest_creatorId_idx" ON "HelpRequest"("creatorId");
DO $$ BEGIN
  ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_nodeId_fkey"
    FOREIGN KEY ("nodeId") REFERENCES "JourneyNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
