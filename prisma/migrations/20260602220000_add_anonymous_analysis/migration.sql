-- CreateTable
CREATE TABLE "AnonymousAnalysis" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "industryName" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "scoreDetail" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnonymousAnalysis_anonymousId_idx" ON "AnonymousAnalysis"("anonymousId");

-- CreateIndex
CREATE INDEX "AnonymousAnalysis_userId_idx" ON "AnonymousAnalysis"("userId");

-- CreateIndex
CREATE INDEX "AnonymousAnalysis_expiresAt_idx" ON "AnonymousAnalysis"("expiresAt");
