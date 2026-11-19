-- Additive audit storage only. Grants no administrator access and publishes no models.
-- Publication/revocation and the corresponding event must commit in one transaction.
CREATE TABLE "SharedModelPublicationEvent" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "artifactSha256" TEXT NOT NULL,
    "compatibilitySnapshot" JSONB NOT NULL,
    "limitations" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedModelPublicationEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SharedModelPublicationEvent_action_check"
      CHECK ("action" IN ('PUBLISH', 'REVOKE'))
);
CREATE INDEX "SharedModelPublicationEvent_modelId_createdAt_idx"
    ON "SharedModelPublicationEvent"("modelId", "createdAt");
CREATE INDEX "SharedModelPublicationEvent_actorUserId_createdAt_idx"
    ON "SharedModelPublicationEvent"("actorUserId", "createdAt");
