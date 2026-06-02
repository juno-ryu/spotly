-- CreateTable
CREATE TABLE "AnalysisReview" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalysisReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisReview_reportId_userId_key" ON "AnalysisReview"("reportId", "userId");

-- CreateIndex
CREATE INDEX "AnalysisReview_reportId_idx" ON "AnalysisReview"("reportId");

-- CreateIndex
CREATE INDEX "AnalysisReview_userId_idx" ON "AnalysisReview"("userId");

-- CreateIndex
CREATE INDEX "AnalysisReview_createdAt_idx" ON "AnalysisReview"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "AnalysisReview" ADD CONSTRAINT "AnalysisReview_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "AnalysisReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
