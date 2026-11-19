-- CreateTable
CREATE TABLE "Workload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hardwareProfileId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inputSize" DOUBLE PRECISION NOT NULL,
    "inputUnit" TEXT NOT NULL,
    "operationCount" DOUBLE PRECISION NOT NULL,
    "arithmeticIntensity" DOUBLE PRECISION NOT NULL,
    "parallelFraction" DOUBLE PRECISION NOT NULL,
    "memoryMiB" DOUBLE PRECISION NOT NULL,
    "transferMiB" DOUBLE PRECISION NOT NULL,
    "repetitions" INTEGER NOT NULL,
    "presetId" TEXT,
    "assumptions" JSONB NOT NULL,
    "tolerance" DOUBLE PRECISION NOT NULL,
    "provenance" "Provenance" NOT NULL DEFAULT 'USER_ENTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComparisonResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workloadId" TEXT,
    "hardwareProfileId" TEXT,
    "kind" TEXT NOT NULL,
    "workloadSnapshot" JSONB NOT NULL,
    "hardwareSnapshot" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "provenance" "Provenance" NOT NULL DEFAULT 'ANALYTICAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComparisonResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workload_userId_updatedAt_idx" ON "Workload"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Workload_hardwareProfileId_idx" ON "Workload"("hardwareProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Workload_id_userId_key" ON "Workload"("id", "userId");

-- CreateIndex
CREATE INDEX "ComparisonResult_userId_createdAt_idx" ON "ComparisonResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ComparisonResult_workloadId_idx" ON "ComparisonResult"("workloadId");

-- CreateIndex
CREATE INDEX "ComparisonResult_hardwareProfileId_idx" ON "ComparisonResult"("hardwareProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ComparisonResult_id_userId_key" ON "ComparisonResult"("id", "userId");

-- AddForeignKey
ALTER TABLE "Workload" ADD CONSTRAINT "Workload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workload" ADD CONSTRAINT "Workload_hardwareProfileId_fkey" FOREIGN KEY ("hardwareProfileId") REFERENCES "HardwareProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonResult" ADD CONSTRAINT "ComparisonResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonResult" ADD CONSTRAINT "ComparisonResult_workloadId_fkey" FOREIGN KEY ("workloadId") REFERENCES "Workload"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComparisonResult" ADD CONSTRAINT "ComparisonResult_hardwareProfileId_fkey" FOREIGN KEY ("hardwareProfileId") REFERENCES "HardwareProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
