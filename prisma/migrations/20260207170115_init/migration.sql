-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AnalysisRequest" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "industryCode" TEXT NOT NULL,
    "industryName" TEXT NOT NULL,
    "radius" INTEGER NOT NULL,
    "regionCode" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "totalScore" DOUBLE PRECISION,
    "scoreDetail" JSONB,
    "reportData" JSONB,
    "aiSummary" TEXT,
    "aiReportJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndustryCategory" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentCode" TEXT,
    "level" INTEGER NOT NULL,
    "keywords" TEXT[],
    "isPopular" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "IndustryCategory_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "AnalysisRequest_latitude_longitude_idx" ON "AnalysisRequest"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "AnalysisRequest_industryCode_idx" ON "AnalysisRequest"("industryCode");

-- CreateIndex
CREATE INDEX "AnalysisRequest_createdAt_idx" ON "AnalysisRequest"("createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCache_cacheKey_key" ON "ApiCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ApiCache_cacheKey_idx" ON "ApiCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ApiCache_source_idx" ON "ApiCache"("source");

-- CreateIndex
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");

-- CreateIndex
CREATE INDEX "IndustryCategory_parentCode_idx" ON "IndustryCategory"("parentCode");

-- CreateIndex
CREATE INDEX "IndustryCategory_isPopular_idx" ON "IndustryCategory"("isPopular");
