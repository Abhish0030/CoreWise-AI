CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE "KnowledgeDocument" (
 "id" TEXT PRIMARY KEY, "ownerId" TEXT REFERENCES "User"("id") ON DELETE CASCADE,
 "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
 "title" TEXT NOT NULL, "text" TEXT NOT NULL, "contentHash" TEXT NOT NULL, "provenance" TEXT NOT NULL,
 "embeddingModel" TEXT NOT NULL, "embeddingRevision" TEXT NOT NULL, "embeddingDimension" INTEGER NOT NULL DEFAULT 384,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "KnowledgeDocument_scope" CHECK (("visibility"='PRIVATE' AND "ownerId" IS NOT NULL) OR ("visibility"='PUBLIC' AND "ownerId" IS NULL AND "sourceType"='PROJECT_DOCUMENTATION')),
 CONSTRAINT "KnowledgeDocument_model" CHECK ("embeddingDimension"=384 AND "embeddingModel"='sentence-transformers/all-MiniLM-L6-v2' AND "embeddingRevision"='1110a243fdf4706b3f48f1d95db1a4f5529b4d41')
);
CREATE TABLE "KnowledgeChunk" (
 "id" TEXT PRIMARY KEY, "documentId" TEXT NOT NULL REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE,
 "chunkIndex" INTEGER NOT NULL CHECK ("chunkIndex">=0), "text" TEXT NOT NULL,
 "contentHash" TEXT NOT NULL, "embedding" vector(384) NOT NULL,
 CONSTRAINT "KnowledgeChunk_nonzero" CHECK (vector_norm("embedding") > 0)
);
CREATE INDEX "KnowledgeDocument_ownerId_visibility_idx" ON "KnowledgeDocument"("ownerId", "visibility");
CREATE INDEX "KnowledgeDocument_sourceType_sourceId_idx" ON "KnowledgeDocument"("sourceType", "sourceId");
CREATE INDEX "KnowledgeDocument_contentHash_idx" ON "KnowledgeDocument"("contentHash");
CREATE UNIQUE INDEX "KnowledgeDocument_private_source" ON "KnowledgeDocument"("ownerId", "sourceType", "sourceId") WHERE "visibility"='PRIVATE';
CREATE UNIQUE INDEX "KnowledgeDocument_public_source" ON "KnowledgeDocument"("sourceType", "sourceId") WHERE "visibility"='PUBLIC';
CREATE UNIQUE INDEX "KnowledgeChunk_documentId_chunkIndex_key" ON "KnowledgeChunk"("documentId", "chunkIndex");
CREATE INDEX "KnowledgeChunk_contentHash_idx" ON "KnowledgeChunk"("contentHash");
-- Exact cosine search initially. No speculative HNSW index or mixed-model vectors.
