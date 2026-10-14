ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "levelTrack" TEXT NOT NULL DEFAULT 'rising_craftsman';
DO $$ BEGIN CREATE TYPE "ProjectStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "DropType" AS ENUM ('STREAM_VOD_7DAY', 'PERMANENT_TEASE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "ActionType" AS ENUM ('SUGGESTION', 'CRITIQUE', 'ENCOURAGEMENT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL, "creatorId" TEXT NOT NULL, "title" TEXT NOT NULL, "intentStatement" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "JourneyNode" (
    "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "position" INTEGER NOT NULL,
    "dayLabel" TEXT NOT NULL, "phaseTitle" TEXT NOT NULL, "summaryText" TEXT NOT NULL,
    "prevSnapshotUrl" TEXT, "nextSnapshotUrl" TEXT, "evolutionDelta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "JourneyNode_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "MediaDrop" (
    "id" TEXT NOT NULL, "journeyNodeId" TEXT NOT NULL, "type" "DropType" NOT NULL,
    "videoUrl" TEXT NOT NULL, "durationSecs" INTEGER NOT NULL, "decisionMetric" TEXT, "tag" TEXT,
    "isLiveExtract" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaDrop_pkey" PRIMARY KEY ("id"));
CREATE TABLE IF NOT EXISTS "Contribution" (
    "id" TEXT NOT NULL, "journeyNodeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "type" "ActionType" NOT NULL,
    "messageText" TEXT NOT NULL, "isPinnedByHost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id"));
CREATE INDEX IF NOT EXISTS "Project_creatorId_idx" ON "Project"("creatorId");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");
CREATE INDEX IF NOT EXISTS "JourneyNode_projectId_position_idx" ON "JourneyNode"("projectId", "position");
CREATE INDEX IF NOT EXISTS "MediaDrop_journeyNodeId_idx" ON "MediaDrop"("journeyNodeId");
CREATE INDEX IF NOT EXISTS "Contribution_journeyNodeId_idx" ON "Contribution"("journeyNodeId");
CREATE INDEX IF NOT EXISTS "Contribution_userId_idx" ON "Contribution"("userId");
DO $$ BEGIN ALTER TABLE "User" ADD CONSTRAINT "User_handle_key" UNIQUE ("handle"); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "JourneyNode" ADD CONSTRAINT "JourneyNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "MediaDrop" ADD CONSTRAINT "MediaDrop_journeyNodeId_fkey" FOREIGN KEY ("journeyNodeId") REFERENCES "JourneyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_journeyNodeId_fkey" FOREIGN KEY ("journeyNodeId") REFERENCES "JourneyNode"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ProjectFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectFollow_userId_projectId_key" ON "ProjectFollow"("userId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectFollow_userId_idx" ON "ProjectFollow"("userId");
CREATE INDEX IF NOT EXISTS "ProjectFollow_projectId_idx" ON "ProjectFollow"("projectId");
DO $$ BEGIN ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "currentState" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "nextStep" TEXT;

DO $$ BEGIN CREATE TYPE "SessionVisibility" AS ENUM ('PUBLIC', 'PRIVATE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "SessionMode" AS ENUM ('LIVE', 'RECORDED', 'PROGRESS_UPDATE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "WorkSession" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "currentState" TEXT,
    "nextStep" TEXT,
    "visibility" "SessionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "mode" "SessionMode" NOT NULL DEFAULT 'LIVE',
    "roomId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkSession_creatorId_idx" ON "WorkSession"("creatorId");
CREATE INDEX IF NOT EXISTS "WorkSession_projectId_idx" ON "WorkSession"("projectId");
CREATE INDEX IF NOT EXISTS "WorkSession_visibility_isActive_idx" ON "WorkSession"("visibility", "isActive");
DO $$ BEGIN ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
