import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { PostCategories } from "./collections/PostCategories";
import { Redirects } from "./collections/Redirects";
import { SiteSettings } from "./globals/SiteSettings";
import { Navigation } from "./globals/Navigation";
import { validateWebEnv } from "./env";
import { migrations } from "./migrations";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const env = validateWebEnv();

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Pages, Posts, PostCategories, Redirects],
  globals: [SiteSettings, Navigation],
  editor: lexicalEditor(),
  sharp,
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URI,
    },
    push: process.env.NODE_ENV !== "production",
    migrationDir: path.resolve(dirname, "migrations"),
    prodMigrations: migrations,
  }),
  cors: [env.NEXT_PUBLIC_SERVER_URL, env.NEXT_PUBLIC_MEDUSA_URL].filter(Boolean),
  csrf: [env.NEXT_PUBLIC_SERVER_URL],
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
});
