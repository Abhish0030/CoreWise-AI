ALTER TABLE "HardwareProfile" ADD COLUMN "detectionSnapshot" JSONB;
ALTER TABLE "LocalAgent" ADD COLUMN "latestTelemetry" JSONB;
ALTER TABLE "LocalAgent" ADD COLUMN "telemetryReceivedAt" TIMESTAMP(3);
