-- Run only in the disposable database created by scripts/test-database.mjs.
DO $$ BEGIN
  IF current_database() <> 'nuxt_note_foundation_test' THEN
    RAISE EXCEPTION 'Expected disposable foundation test database';
  END IF;
END $$;

INSERT INTO "User" (id, "githubId", "githubLogin", name, "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', '1001', 'note-owner', 'Note owner', '2026-11-03'),
  ('22222222-2222-4222-8222-222222222222', '1002', 'second-owner', 'Second owner', '2026-11-03');
INSERT INTO "Category" (id, name, "nameKey", "userId", "updatedAt") VALUES
  ('category', 'Learning', 'learning', '11111111-1111-4111-8111-111111111111', '2026-11-03');
INSERT INTO "Note" (id, title, markdown, "userId", "categoryId", "updatedAt") VALUES
  ('note', 'Keep this note', '# Original body', '11111111-1111-4111-8111-111111111111', 'category', '2026-11-03'),
  ('uncategorized', 'No category', '', '22222222-2222-4222-8222-222222222222', NULL, '2026-11-03');
