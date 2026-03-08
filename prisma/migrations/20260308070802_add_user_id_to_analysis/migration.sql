-- AlterTable
ALTER TABLE "AnalysisRequest" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "AnalysisRequest_userId_idx" ON "AnalysisRequest"("userId");
