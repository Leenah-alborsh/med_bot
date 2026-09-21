import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'dotenv -e ../../.env -e ../../.env.example -- tsx prisma/seed.ts',
  },
});
