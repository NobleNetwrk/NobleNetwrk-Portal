-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AirdropProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalAllocation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckIn" TIMESTAMP(3),
    "weeklyClaimed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirdropProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "address" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "LockedK9" (
    "id" TEXT NOT NULL,
    "userWallet" TEXT NOT NULL,
    "nftMint" TEXT NOT NULL,
    "nftName" TEXT NOT NULL,
    "nftImage" TEXT NOT NULL,
    "lockDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalNTWRKAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL,
    "currentUnlockCost" DOUBLE PRECISION NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockDate" TIMESTAMP(3),
    "unlockSignature" TEXT,
    "lastInterestUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LockedK9_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AirdropProfile_userId_key" ON "AirdropProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LockedK9_nftMint_key" ON "LockedK9"("nftMint");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- AddForeignKey
ALTER TABLE "AirdropProfile" ADD CONSTRAINT "AirdropProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockedK9" ADD CONSTRAINT "LockedK9_userWallet_fkey" FOREIGN KEY ("userWallet") REFERENCES "Wallet"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
