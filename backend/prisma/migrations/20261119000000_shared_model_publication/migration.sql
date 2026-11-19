-- Approval ledger only. No existing model is published by this migration.
CREATE TABLE "SharedModelPublication" (
    "modelId" TEXT NOT NULL,
    "approvedArtifactSha256" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hardwareCompatibility" JSONB NOT NULL,
    "limitations" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "SharedModelPublication_pkey" PRIMARY KEY ("modelId"),
    CONSTRAINT "SharedModelPublication_modelId_fkey" FOREIGN KEY ("modelId")
      REFERENCES "MLModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
