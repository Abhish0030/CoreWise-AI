-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "rows" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "config" JSONB NOT NULL,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLModel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "trainingJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "selected" BOOLEAN NOT NULL,
    "sha256" TEXT NOT NULL,
    "artifactLocation" TEXT NOT NULL,
    "featureSchema" JSONB NOT NULL,
    "evaluation" JSONB NOT NULL,
    "trainingConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MLPrediction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workloadId" TEXT,
    "hardwareProfileId" TEXT,
    "workloadSnapshot" JSONB NOT NULL,
    "hardwareSnapshot" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "provenance" "Provenance" NOT NULL DEFAULT 'PREDICTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MLPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dataset_userId_createdAt_idx" ON "Dataset"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_id_userId_key" ON "Dataset"("id", "userId");

-- CreateIndex
CREATE INDEX "TrainingJob_status_createdAt_idx" ON "TrainingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingJob_userId_createdAt_idx" ON "TrainingJob"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingJob_id_userId_key" ON "TrainingJob"("id", "userId");

-- CreateIndex
CREATE INDEX "MLModel_userId_target_active_idx" ON "MLModel"("userId", "target", "active");

-- CreateIndex
CREATE INDEX "MLModel_datasetId_idx" ON "MLModel"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "MLModel_id_userId_key" ON "MLModel"("id", "userId");

-- CreateIndex
CREATE INDEX "MLPrediction_userId_createdAt_idx" ON "MLPrediction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MLPrediction_id_userId_key" ON "MLPrediction"("id", "userId");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingJob" ADD CONSTRAINT "TrainingJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingJob" ADD CONSTRAINT "TrainingJob_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLModel" ADD CONSTRAINT "MLModel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLModel" ADD CONSTRAINT "MLModel_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLModel" ADD CONSTRAINT "MLModel_trainingJobId_fkey" FOREIGN KEY ("trainingJobId") REFERENCES "TrainingJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MLPrediction" ADD CONSTRAINT "MLPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Prevent conflicting jobs and active target versions, including concurrent requests.
-- Partial indexes are maintained here because Prisma cannot represent their predicates.

CREATE UNIQUE INDEX "TrainingJob_one_inflight_owner" ON "TrainingJob" ("userId") WHERE status IN ('QUEUED','RUNNING');
CREATE UNIQUE INDEX "MLModel_one_active_target" ON "MLModel" ("userId",target) WHERE active=true;
