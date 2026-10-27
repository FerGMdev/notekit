-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('NOTE', 'SNIPPET');

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "collectionId" TEXT,
ADD COLUMN     "kind" "NoteKind" NOT NULL DEFAULT 'NOTE',
ADD COLUMN     "language" TEXT;

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Collection_userId_updatedAt_idx" ON "Collection"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_userId_name_key" ON "Collection"("userId", "name");

-- CreateIndex
CREATE INDEX "Note_userId_kind_updatedAt_idx" ON "Note"("userId", "kind", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Note_userId_language_idx" ON "Note"("userId", "language");

-- CreateIndex
CREATE INDEX "Note_userId_collectionId_idx" ON "Note"("userId", "collectionId");

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

