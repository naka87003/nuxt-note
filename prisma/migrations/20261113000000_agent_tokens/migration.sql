BEGIN;

CREATE TABLE "AgentToken" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "AgentToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentToken_tokenHash_key" ON "AgentToken"("tokenHash");
CREATE INDEX "AgentToken_userId_createdAt_idx" ON "AgentToken"("userId", "createdAt");
ALTER TABLE "AgentToken" ADD CONSTRAINT "AgentToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentToken" ENABLE ROW LEVEL SECURITY;

COMMIT;
