import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { fileURLToPath } from "url";
import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { validateWebEnv } from "./env";

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
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URI,
    },
  }),
  cors: [env.NEXT_PUBLIC_SERVER_URL, env.NEXT_PUBLIC_MEDUSA_URL].filter(Boolean),
  csrf: [env.NEXT_PUBLIC_SERVER_URL],
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
});
