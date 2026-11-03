# Notebook migration

The one-time importer reads TablePlus UTF-8 `notes.csv` and `tags.csv`. It imports only an explicit Notebook owner into an explicit existing Nuxt Note account. Tags become categories using the application's trimmed, NFKC/lowercase category keys; untagged notes remain uncategorized. Images are omitted. Original bodies are preserved verbatim. Blank titles use the first nonblank body line, limited to 200 UTF-16 code units, or `Untitled note`.

The confirmed source is Notebook user 12, with 753 active Note records, 29 used tags, and `APP_TIMEZONE=Asia/Tokyo`. Source creation/update timestamps are converted from Tokyo time to UTC for the application's timestamp columns. Schedule fields, public flags, tag colors, images and social data are not imported. Only category 1/status 1 records are accepted; other kinds require an explicit mapping change.

Run with Node 26.11.1 from the repository root. The configured `DIRECT_URL` (or `DATABASE_URL`) must point to the intended Nuxt Note database. Never commit exported data or connection strings.

```bash
node scripts/import-notebook.mjs \
  --source /absolute/path/to/export \
  --source-user 12 \
  --target-user TARGET_DATABASE_UUID \
  --github-login TARGET_GITHUB_LOGIN \
  --expected-count 753
```

This defaults to a read-only database transaction. Review the account, existing note count, pending note count and new category count. Add `--apply` to perform the import in one transaction. All new content, category assignments and timestamps are read back and compared before commit; failure rolls back the transaction.

Apply saves a private pre-import snapshot and a manifest under ignored `.data/notebook-import/` before inserting. These contain personal data and must not be committed. The snapshot covers the target user's existing notes/categories. A manifest marked `pending` does not prove rollback: if the process ends during commit or manifest finalization, inspect the target IDs in the database. `committed` indicates successful verification and commit.

Deterministic note IDs include source owner/note IDs and the target account, so an identical rerun skips previously imported notes. It never updates or deletes existing notes or categories, including edits to previously imported notes. Existing categories with matching normalized names are reused. Do not change the identity scheme between retries. Deleting an imported note and rerunning recreates it; moving one to another owner causes a primary-key conflict and rollback.

After import, run the same read-only command again: pending notes should be zero. Check the signed-in production Notes UI for category counts, uncategorized notes, Tokyo display dates and Markdown rendering. Literal text in Notebook may render as Markdown in Nuxt Note even though the original text is preserved. The source CSVs remain the archive for omitted fields. A manual rollback, if needed, must use the manifest IDs and check subsequent edits/category usage first; no automated destructive rollback is provided.

## Validation and completed import

Run `node scripts/test-notebook-import.mjs` with Docker available for a disposable PostgreSQL integration check. It never loads application credentials, uses synthetic CSVs and a loopback-only temporary database, and checks read-only preview, account mismatch rejection, rollback after a partial insert, successful import, Tokyo timestamps, existing-note preservation and repeat execution. Unit coverage in `tests/unit/notebook-import.test.ts` also covers CSV quoting/newlines, malformed input, owner filtering and tag validation.

On 2026-11-03 (JST), 753 notes were imported into the configured Nuxt Note database. Twenty-nine tag categories were mapped: 28 created and one existing category reused. Twenty-seven imported notes are uncategorized. The existing note was preserved, giving 754 notes in total. All inserted titles, bodies, category assignments and timestamps were compared with the prepared source before commit. A subsequent read-only run found all 753 deterministic IDs and zero pending inserts. Backups and the committed manifest are retained under `.data/notebook-import/`. No source records or database schema were changed. All 166 unit tests, typecheck, changed-file lint/formatting and the disposable database integration check passed. Authenticated production UI review remains a manual follow-up.
