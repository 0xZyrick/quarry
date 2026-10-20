-- Spatial registry: durable rooms, crew, hub state, handle claims

CREATE TABLE "GuildRoom" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ownerUid" TEXT,
    "handle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildCrewMember" (
    "roomId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildCrewMember_pkey" PRIMARY KEY ("roomId","uid")
);

CREATE TABLE "GuildHub" (
    "roomId" TEXT NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "greenroom" BOOLEAN NOT NULL DEFAULT false,
    "gateCanvas" TEXT,
    "gateSkill" TEXT,
    "metaTitle" TEXT,
    "metaTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metaEnv" TEXT,
    "metaPath" TEXT,
    "metaZone" TEXT,
    "flagUids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildHub_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "GuildHandle" (
    "handle" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildHandle_pkey" PRIMARY KEY ("handle")
);

CREATE INDEX "GuildRoom_ownerUid_idx" ON "GuildRoom"("ownerUid");
CREATE INDEX "GuildRoom_handle_idx" ON "GuildRoom"("handle");
CREATE INDEX "GuildCrewMember_uid_idx" ON "GuildCrewMember"("uid");
CREATE INDEX "GuildHandle_uid_idx" ON "GuildHandle"("uid");

ALTER TABLE "GuildCrewMember" ADD CONSTRAINT "GuildCrewMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GuildRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildHub" ADD CONSTRAINT "GuildHub_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GuildRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
