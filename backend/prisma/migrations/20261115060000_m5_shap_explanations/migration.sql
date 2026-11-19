-- CreateTable
CREATE TABLE "ModelExplanation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "predictionId" TEXT,
    "modelId" TEXT,
    "cacheKey" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "leaseUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModelExplanation_userId_createdAt_idx" ON "ModelExplanation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ModelExplanation_predictionId_idx" ON "ModelExplanation"("predictionId");

-- CreateIndex
CREATE INDEX "ModelExplanation_modelId_idx" ON "ModelExplanation"("modelId");

-- CreateIndex
CREATE INDEX "ModelExplanation_status_createdAt_idx" ON "ModelExplanation"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelExplanation_userId_cacheKey_key" ON "ModelExplanation"("userId", "cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "ModelExplanation_id_userId_key" ON "ModelExplanation"("id", "userId");

-- AddForeignKey
ALTER TABLE "ModelExplanation" ADD CONSTRAINT "ModelExplanation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelExplanation" ADD CONSTRAINT "ModelExplanation_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "MLPrediction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
