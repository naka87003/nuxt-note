ALTER TABLE "AgentToken" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY['notes:read']::TEXT[];
