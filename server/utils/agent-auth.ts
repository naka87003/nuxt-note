import { createHash, randomBytes } from "node:crypto";
import type { H3Event } from "h3";
import { createError } from "nuxt/server";
import { getPrisma } from "./prisma";

export const agentTokenSelect = {
  id: true,
  name: true,
  createdAt: true,
  expiresAt: true,
  revokedAt: true,
} as const;

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newAgentToken() {
  const token = `nnr_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    tokenHash: hashAgentToken(token),
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  };
}

export function privateAgentResponse(event: H3Event) {
  setHeader(event, "Cache-Control", "private, no-store");
}

// Bearer tokens authorize MCP reads and creation, never browser sessions.
export async function getAgentUserId(event: H3Event) {
  privateAgentResponse(event);
  const match = /^Bearer (nnr_[A-Za-z0-9_-]{43})$/i.exec(
    getHeader(event, "authorization") ?? "",
  );
  const record = match
    ? await getPrisma().agentToken.findUnique({
        where: { tokenHash: hashAgentToken(match[1]!) },
        select: {
          userId: true,
          expiresAt: true,
          revokedAt: true,
        },
      })
    : null;
  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    setHeader(event, "WWW-Authenticate", 'Bearer realm="nuxt-note"');
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired token",
    });
  }
  return record.userId;
}
