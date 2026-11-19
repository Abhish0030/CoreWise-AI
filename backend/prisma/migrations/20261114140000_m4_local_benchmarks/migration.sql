-- CreateTable
CREATE TABLE "AgentPairing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "environment" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "measurement" JSONB NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "provenance" "Provenance" NOT NULL DEFAULT 'MEASURED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPairing_codeHash_key" ON "AgentPairing"("codeHash");

-- CreateIndex
CREATE INDEX "AgentPairing_expiresAt_idx" ON "AgentPairing"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAgent_tokenHash_key" ON "LocalAgent"("tokenHash");

-- CreateIndex
CREATE INDEX "LocalAgent_userId_createdAt_idx" ON "LocalAgent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAgent_id_userId_key" ON "LocalAgent"("id", "userId");

-- CreateIndex
CREATE INDEX "BenchmarkJob_agentId_status_createdAt_idx" ON "BenchmarkJob"("agentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkJob_userId_createdAt_idx" ON "BenchmarkJob"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkJob_id_userId_key" ON "BenchmarkJob"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkRun_jobId_key" ON "BenchmarkRun"("jobId");

-- CreateIndex
CREATE INDEX "BenchmarkRun_userId_createdAt_idx" ON "BenchmarkRun"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkRun_id_userId_key" ON "BenchmarkRun"("id", "userId");

-- AddForeignKey
ALTER TABLE "AgentPairing" ADD CONSTRAINT "AgentPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalAgent" ADD CONSTRAINT "LocalAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkJob" ADD CONSTRAINT "BenchmarkJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkJob" ADD CONSTRAINT "BenchmarkJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LocalAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "LocalAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BenchmarkJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "BenchmarkJob_one_inflight_agent" ON "BenchmarkJob" ("agentId") WHERE status IN ('QUEUED','RUNNING','CANCEL_REQUESTED');
