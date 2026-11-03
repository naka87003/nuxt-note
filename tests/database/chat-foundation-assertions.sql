DO $$ BEGIN
  IF (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
    AND relname IN ('User', 'Category', 'Note', 'Chat', 'Message') AND relrowsecurity) <> 5 THEN
    RAISE EXCEPTION 'All five application tables must have RLS';
  END IF;
  IF to_regclass('public."Project"') IS NOT NULL THEN
    RAISE EXCEPTION 'Project must be replaced by the shared Category';
  END IF;
  IF EXISTS (SELECT 1 FROM "Chat") OR EXISTS (SELECT 1 FROM "Message") THEN
    RAISE EXCEPTION 'Migration must not import or seed Chat records';
  END IF;
END $$;

-- Notes and conversations share exactly the same category record.
INSERT INTO "Chat" (id, title, "userId", "categoryId", "updatedAt") VALUES
  ('chat', 'First chat', '11111111-1111-4111-8111-111111111111', 'category', now());
INSERT INTO "Message" (id, content, role, "chatId", "updatedAt") VALUES
  ('message', 'Hello', 'user', 'chat', now()),
  ('reply', 'Welcome', 'assistant', 'chat', now());
UPDATE "Category" SET name = 'Renamed learning', "nameKey" = 'renamed learning' WHERE id = 'category';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Note" n JOIN "Chat" c ON c."categoryId" = n."categoryId"
    JOIN "Category" g ON g.id = c."categoryId"
    WHERE n.id = 'note' AND c.id = 'chat' AND g.name = 'Renamed learning') THEN
    RAISE EXCEPTION 'Notes and chats must share category identity and rename';
  END IF;
  BEGIN
    INSERT INTO "Category" (id, name, "nameKey", "userId", "updatedAt") VALUES
      ('duplicate', 'Renamed learning', 'renamed learning', '11111111-1111-4111-8111-111111111111', now());
    RAISE EXCEPTION 'Duplicate category names accepted for one owner';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;
-- The same category name remains valid for another account.
INSERT INTO "Category" (id, name, "nameKey", "userId", "updatedAt") VALUES
  ('other-category', 'Renamed learning', 'renamed learning', '22222222-2222-4222-8222-222222222222', now());

CREATE ROLE foundation_anon NOLOGIN;
GRANT USAGE ON SCHEMA public TO foundation_anon;
GRANT SELECT, INSERT ON "Category", "Note", "Chat", "Message" TO foundation_anon;
SET ROLE foundation_anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Category") OR EXISTS (SELECT 1 FROM "Note")
    OR EXISTS (SELECT 1 FROM "Chat") OR EXISTS (SELECT 1 FROM "Message") THEN
    RAISE EXCEPTION 'RLS exposed private content';
  END IF;
  BEGIN
    INSERT INTO "Category" (id, name, "nameKey", "userId", "updatedAt") VALUES
      ('anonymous', 'Denied', 'denied', '11111111-1111-4111-8111-111111111111', now());
    RAISE EXCEPTION 'RLS allowed an anonymous insert';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

DO $$ BEGIN
  BEGIN
    INSERT INTO "Chat" (id, "userId", "updatedAt") VALUES ('orphan', 'missing-owner', now());
    RAISE EXCEPTION 'Chat accepted a missing owner';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "Chat" (id, "userId", "categoryId", "updatedAt") VALUES
      ('orphan-category', '11111111-1111-4111-8111-111111111111', 'missing-category', now());
    RAISE EXCEPTION 'Chat accepted a missing category';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO "Message" (id, content, role, "chatId", "updatedAt") VALUES
      ('orphan', 'Denied', 'user', 'missing-chat', now());
    RAISE EXCEPTION 'Message accepted a missing chat';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

DELETE FROM "Category" WHERE id = 'category';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Chat" WHERE id = 'chat' AND "categoryId" IS NULL)
    OR NOT EXISTS (SELECT 1 FROM "Note" WHERE id = 'note' AND "categoryId" IS NULL AND markdown = '# Original body')
    OR (SELECT count(*) FROM "Message" WHERE "chatId" = 'chat') <> 2 THEN
    RAISE EXCEPTION 'Category deletion must uncategorize notes and chats without deleting content';
  END IF;
END $$;

DELETE FROM "Chat" WHERE id = 'chat';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Message") THEN RAISE EXCEPTION 'Chat deletion left orphan messages'; END IF;
END $$;

INSERT INTO "Category" (id, name, "nameKey", "userId", "updatedAt") VALUES
  ('category', 'Learning', 'learning', '11111111-1111-4111-8111-111111111111', now());
UPDATE "Note" SET "categoryId" = 'category' WHERE id = 'note';
INSERT INTO "Chat" (id, "userId", "categoryId", "updatedAt") VALUES
  ('chat', '11111111-1111-4111-8111-111111111111', 'category', now());
INSERT INTO "Message" (id, content, role, "chatId", "updatedAt") VALUES
  ('message', 'Hello', 'user', 'chat', now());
DELETE FROM "User" WHERE id = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Chat") OR EXISTS (SELECT 1 FROM "Message")
    OR EXISTS (SELECT 1 FROM "Note" WHERE id = 'note') OR EXISTS (SELECT 1 FROM "Category" WHERE id = 'category') THEN
    RAISE EXCEPTION 'User deletion did not cascade through owned content';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Note" WHERE id = 'uncategorized'
    AND "userId" = '22222222-2222-4222-8222-222222222222')
    OR NOT EXISTS (SELECT 1 FROM "Category" WHERE id = 'other-category') THEN
    RAISE EXCEPTION 'User deletion changed another owners content';
  END IF;
END $$;
SELECT 'Shared categories, init, RLS, foreign keys, and deletion checks passed' AS result;
