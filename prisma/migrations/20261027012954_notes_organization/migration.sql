-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Note_userId_deletedAt_updatedAt_idx" ON "Note"("userId", "deletedAt", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Note_userId_isFavorite_idx" ON "Note"("userId", "isFavorite");
