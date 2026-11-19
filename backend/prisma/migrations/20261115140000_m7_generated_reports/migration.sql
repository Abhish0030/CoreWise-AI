-- CreateTable
CREATE TABLE "GeneratedReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "configuration" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "exportMetadata" JSONB NOT NULL,
    "pdf" BYTEA NOT NULL,
    "csv" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedReport_userId_createdAt_idx" ON "GeneratedReport"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedReport_id_userId_key" ON "GeneratedReport"("id", "userId");

-- AddForeignKey
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
