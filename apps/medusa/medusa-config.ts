import { defineConfig } from "@medusajs/framework/utils";
import { validateMedusaEnv } from "./src/env";

const env = validateMedusaEnv();

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    workerMode: env.MEDUSA_WORKER_MODE,
    http: {
      storeCors: env.STORE_CORS,
      adminCors: env.ADMIN_CORS,
      authCors: env.AUTH_CORS,
      jwtSecret: env.JWT_SECRET,
      cookieSecret: env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: false,
    backendUrl: process.env.MEDUSA_ADMIN_BACKEND_URL || `http://${env.HOST}:${env.PORT}`,
  },
  modules: [
    {
      resolve: "./src/modules/payment-guard",
    },
  ],
});
