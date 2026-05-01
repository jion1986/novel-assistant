-- Add ownership to books after the authentication system was introduced.
-- Existing pre-auth books are assigned to the first user, or to a legacy local
-- owner created only for migration continuity.

INSERT INTO "users" ("id", "username", "password", "createdAt")
SELECT
    'legacy-local-owner',
    'legacy_owner',
    '$2a$10$CwTycUXWue0Thq9StjUM0uJ8kA9D2WmcuUW5b7nqLSZ2LU5jtyWZe',
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "books")
  AND NOT EXISTS (SELECT 1 FROM "users");

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_books" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "coreIdea" TEXT NOT NULL,
    "targetWords" INTEGER,
    "style" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "books_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_books" (
    "id",
    "userId",
    "title",
    "genre",
    "coreIdea",
    "targetWords",
    "style",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    (SELECT "id" FROM "users" ORDER BY "createdAt" ASC LIMIT 1),
    "title",
    "genre",
    "coreIdea",
    "targetWords",
    "style",
    "status",
    "createdAt",
    "updatedAt"
FROM "books";

DROP TABLE "books";
ALTER TABLE "new_books" RENAME TO "books";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

CREATE INDEX "books_userId_idx" ON "books"("userId");
CREATE INDEX "characters_bookId_idx" ON "characters"("bookId");
CREATE INDEX "chapters_bookId_idx" ON "chapters"("bookId");
CREATE INDEX "memory_items_bookId_idx" ON "memory_items"("bookId");
CREATE INDEX "foreshadowings_bookId_idx" ON "foreshadowings"("bookId");
CREATE INDEX "generation_runs_bookId_idx" ON "generation_runs"("bookId");
CREATE INDEX "generation_runs_chapterId_idx" ON "generation_runs"("chapterId");
