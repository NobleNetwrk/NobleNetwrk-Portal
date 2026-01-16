// prisma.config.ts
import 'dotenv/config'; 
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // This is now the source of truth for the CLI
    url: env("DATABASE_URL"),
  },
});