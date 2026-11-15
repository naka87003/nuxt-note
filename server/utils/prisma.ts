import { PrismaPg } from "@prisma/adapter-pg";
import { createError } from "nuxt/server";
import { PrismaClient } from "../../generated/prisma/client";

declare global {
  var nuxtNotePrisma: PrismaClient | undefined;
}
let client = globalThis.nuxtNotePrisma;

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
  if (process.env.NODE_ENV !== "production") {
    globalThis.nuxtNotePrisma = client;
  }
  return client;
}
