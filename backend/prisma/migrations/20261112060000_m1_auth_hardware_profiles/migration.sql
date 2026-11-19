-- AlterTable
ALTER TABLE "HardwareProfile" ADD COLUMN     "computeCapability" TEXT,
ADD COLUMN     "cpuBaseGhz" DOUBLE PRECISION,
ADD COLUMN     "cpuManufacturer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "cpuMaxGhz" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "deviceModel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gpuManufacturer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "logicalProcessors" INTEGER,
ADD COLUMN     "manufacturer" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "memoryBandwidthGbps" DOUBLE PRECISION,
ADD COLUMN     "memoryFrequencyMhz" INTEGER,
ADD COLUMN     "memoryType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "physicalCores" INTEGER,
ADD COLUMN     "vramGb" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "data" TEXT NOT NULL DEFAULT '{}',
ALTER COLUMN "tokenHash" DROP NOT NULL,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultProfileId" TEXT,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "selectedProfileId" TEXT;

-- CreateIndex
CREATE INDEX "HardwareProfile_userId_createdAt_idx" ON "HardwareProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HardwareProfile_userId_name_idx" ON "HardwareProfile"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "HardwareProfile_id_userId_key" ON "HardwareProfile"("id", "userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultProfileId_fkey" FOREIGN KEY ("defaultProfileId") REFERENCES "HardwareProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_selectedProfileId_fkey" FOREIGN KEY ("selectedProfileId") REFERENCES "HardwareProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
