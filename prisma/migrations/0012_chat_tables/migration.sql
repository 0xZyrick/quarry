-- Room chat: messages, mic state, handle map

CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "by" TEXT NOT NULL,
    "uid" TEXT,
    "text" TEXT NOT NULL,
    "question" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMicState" (
    "roomId" TEXT NOT NULL,
    "requests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "slots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMicState_pkey" PRIMARY KEY ("roomId")
);

CREATE TABLE "ChatHandle" (
    "roomId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatHandle_pkey" PRIMARY KEY ("roomId","handle")
);

CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");
CREATE INDEX "ChatHandle_roomId_uid_idx" ON "ChatHandle"("roomId", "uid");
