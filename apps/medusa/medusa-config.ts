import path from "path";
import { defineConfig, Modules } from "@medusajs/framework/utils";
import { validateMedusaEnv, resolveCookieSecure } from "./src/env";

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
    cookieOptions: {
      secure: resolveCookieSecure(process.env),
      sameSite: "lax",
    },
  },
  admin: {
    disable: false,
    backendUrl: process.env.MEDUSA_ADMIN_BACKEND_URL,
  },
  modules: [
    {
      resolve: path.resolve(__dirname, "src/modules/payment-settings"),
    },
    {
      resolve: path.resolve(__dirname, "src/modules/email-settings"),
    },
    {
      resolve: path.resolve(__dirname, "src/modules/customer-account"),
    },
    {
      resolve: path.resolve(__dirname, "src/modules/payment-guard"),
      dependencies: [Modules.PAYMENT, Modules.LINK],
    },
    {
      resolve: path.resolve(__dirname, "src/modules/search-indexes"),
      dependencies: [Modules.PRODUCT],
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: path.resolve(__dirname, "src/modules/payment-paytr"),
            id: "paytr",
          },
          {
            resolve: path.resolve(__dirname, "src/modules/payment-cod"),
            id: "cod",
          },
        ],
      },
    },
  ],
});
