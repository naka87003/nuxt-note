import { PrismaPg } from "@prisma/adapter-pg";
import { createError } from "nuxt/server";
import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  nuxtNotePrisma?: PrismaClient;
};
let client = globalForPrisma.nuxtNotePrisma;

export function getPrisma() {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database is not configured",
    });
  }
  client = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 5 }),
  });
  if (process.env.NODE_ENV !== "production")
    globalForPrisma.nuxtNotePrisma = client;
  return client;
}
