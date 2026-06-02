-- AlterTable
ALTER TABLE "AnalysisReport" ADD COLUMN "anonymousId" TEXT;

-- CreateIndex
CREATE INDEX "AnalysisReport_anonymousId_idx" ON "AnalysisReport"("anonymousId");
