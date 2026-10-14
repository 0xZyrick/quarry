-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "handle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paystackSubaccountCode" TEXT,
    "dedicatedBankNumber" TEXT,
    "dedicatedBankName" TEXT,
    "internalCreditBalance" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLedger" (
    "id" TEXT NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "roomId" TEXT,
    "milestoneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE UNIQUE INDEX "Wallet_paystackSubaccountCode_key" ON "Wallet"("paystackSubaccountCode");
CREATE UNIQUE INDEX "Wallet_dedicatedBankNumber_key" ON "Wallet"("dedicatedBankNumber");
CREATE UNIQUE INDEX "TransactionLedger_reference_key" ON "TransactionLedger"("reference");
CREATE INDEX "TransactionLedger_roomId_milestoneId_idx" ON "TransactionLedger"("roomId", "milestoneId");
CREATE INDEX "TransactionLedger_senderId_idx" ON "TransactionLedger"("senderId");
CREATE INDEX "TransactionLedger_receiverId_idx" ON "TransactionLedger"("receiverId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Last line of defence: even a buggy code path cannot overdraw a wallet or record a non-positive amount.
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_balance_nonnegative" CHECK ("internalCreditBalance" >= 0);
ALTER TABLE "TransactionLedger" ADD CONSTRAINT "Ledger_amount_positive" CHECK ("amountKobo" > 0);
