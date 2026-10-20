-- Trust & safety durable tables

CREATE TABLE "SafetyCase" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ownerUid" TEXT,
    "target" TEXT,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "severe" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "held" BOOLEAN NOT NULL DEFAULT false,
    "restoreAt" TIMESTAMP(3),
    "appealText" TEXT,
    "appealAt" TIMESTAMP(3),
    "decisionBy" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionAction" TEXT,
    "decisionNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SafetyReport" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountBan" (
    "uid" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountBan_pkey" PRIMARY KEY ("uid")
);

CREATE TABLE "AccountStrike" (
    "uid" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountStrike_pkey" PRIMARY KEY ("uid")
);

CREATE TABLE "RoomMute" (
    "roomId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMute_pkey" PRIMARY KEY ("roomId","uid")
);

CREATE TABLE "RoomBan" (
    "roomId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBan_pkey" PRIMARY KEY ("roomId","uid")
);

CREATE TABLE "ReporterStats" (
    "uid" TEXT NOT NULL,
    "upheld" INTEGER NOT NULL DEFAULT 0,
    "dismissed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReporterStats_pkey" PRIMARY KEY ("uid")
);

CREATE TABLE "SafetyAudit" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "SafetyAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountSeen" (
    "uid" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSeen_pkey" PRIMARY KEY ("uid")
);

CREATE TABLE "RoomDwell" (
    "roomId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomDwell_pkey" PRIMARY KEY ("roomId","uid")
);

CREATE INDEX "SafetyCase_roomId_state_idx" ON "SafetyCase"("roomId", "state");
CREATE INDEX "SafetyCase_state_severe_idx" ON "SafetyCase"("state", "severe");
CREATE INDEX "SafetyCase_ownerUid_idx" ON "SafetyCase"("ownerUid");
CREATE INDEX "SafetyCase_restoreAt_idx" ON "SafetyCase"("restoreAt");
CREATE UNIQUE INDEX "SafetyReport_caseId_uid_key" ON "SafetyReport"("caseId", "uid");
CREATE INDEX "SafetyReport_uid_createdAt_idx" ON "SafetyReport"("uid", "createdAt");
CREATE INDEX "RoomMute_uid_idx" ON "RoomMute"("uid");
CREATE INDEX "RoomBan_uid_idx" ON "RoomBan"("uid");
CREATE INDEX "SafetyAudit_at_idx" ON "SafetyAudit"("at");

ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
