import crypto from "crypto";
import fs from "fs";
import { createRequire } from "module";
import path from "path";
import type pg from "pg";
import { fileURLToPath } from "url";
import {
  encryptLegacyHash,
  hashEmailLookup,
} from "../../apps/medusa/src/modules/customer-account/helpers";
import {
  detectLegacyAlgorithm,
  type LegacyAlgorithm,
} from "../../apps/medusa/src/modules/customer-account/verifiers/detect";
import { runBatchTransaction } from "./batch-runner";
import { streamCsvRecords } from "./csv-stream";
import { validateMigrationDbGuard } from "./db-guard";
import { formatMaskedReportLine, MigrationReportWriter } from "./report";
import {
  escapeCsvFormula,
  isValidEmail,
  maskEmail,
  normalizeEmail,
  sanitizePhone,
  sanitizeTextField,
} from "./sanitize";

export interface ImportCustomersOptions {
  csvPath: string;
  apply: boolean;
  confirmDatabase?: string;
  allowProduction?: boolean;
  includeGuests?: boolean;
  databaseUrl?: string;
  encryptionKey?: string;
  batchSize?: number;
  writeReport?: boolean;
}

export interface ImportCustomersResult {
  dryRun: boolean;
  totalRows: number;
  wouldCreateRegistered: number;
  wouldCreateGuests: number;
  createdRegistered: number;
  createdGuests: number;
  skippedDuplicates: number;
  skippedExisting: number;
  skippedGuests: number;
  invalidRows: number;
  algorithms: Record<LegacyAlgorithm | "unsupported" | "missing", number>;
  reportPath?: string;
  peakHeapMb: number;
}

interface ParsedAddress {
  addressName: string;
  firstName: string;
  lastName: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  countryCode: string;
  phone: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

interface PreparedCustomerRow {
  rowNumber: number;
  email: string;
  maskedEmail: string;
  isGuest: boolean;
  wcUserId: string | null;
  wcRegisteredAt: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  algorithm: LegacyAlgorithm | null;
  rawHash: string;
  addresses: ParsedAddress[];
}

function parseAddress(
  row: Record<string, string>,
  prefix: "billing_" | "shipping_",
  fallbackFirst: string,
  fallbackLast: string,
  rowNumber: number,
  masked: string,
  report: MigrationReportWriter,
): ParsedAddress | null {
  const a1 = sanitizeTextField(row[`${prefix}address_1`], 200);
  const city = sanitizeTextField(row[`${prefix}city`], 100);
  if (a1.invalid || city.invalid) {
    report.add({ rowNumber, code: "control_char", maskedEmail: masked, field: `${prefix}address` });
    return null;
  }
  if (!a1.value || !city.value) {
    if (a1.value || city.value) {
      report.add({
        rowNumber,
        code: "malformed_address",
        maskedEmail: masked,
        field: `${prefix}address`,
      });
    }
    return null;
  }

  const fn = sanitizeTextField(row[`${prefix}first_name`], 100).value || fallbackFirst;
  const ln = sanitizeTextField(row[`${prefix}last_name`], 100).value || fallbackLast;
  const company = sanitizeTextField(row[`${prefix}company`], 120).value || null;
  const a2 = sanitizeTextField(row[`${prefix}address_2`], 200).value || null;
  const province = sanitizeTextField(row[`${prefix}state`], 100).value || null;
  const postalCode = sanitizeTextField(row[`${prefix}postcode`], 20).value || null;
  const rawCountry = (row[`${prefix}country`] ?? "TR").trim().toLowerCase();
  const countryCode = /^[a-z]{2}$/.test(rawCountry) ? rawCountry : "tr";
  const phoneRes =
    prefix === "billing_" ? sanitizePhone(row.billing_phone) : { value: null, malformed: false };
  if (phoneRes.malformed) {
    report.add({
      rowNumber,
      code: "malformed_phone",
      maskedEmail: masked,
      field: `${prefix}phone`,
    });
  }

  return {
    addressName: prefix === "billing_" ? "Fatura Adresi" : "Teslimat Adresi",
    firstName: fn,
    lastName: ln,
    company,
    address1: a1.value,
    address2: a2,
    city: city.value,
    province,
    postalCode,
    countryCode,
    phone: phoneRes.value,
    isDefaultBilling: prefix === "billing_",
    isDefaultShipping: prefix === "shipping_",
  };
}

export async function importCustomersFromCsv(
  options: ImportCustomersOptions,
): Promise<ImportCustomersResult> {
  const databaseUrl =
    options.databaseUrl ||
    process.env.DATABASE_URL ||
    "postgres://medusa_user:dev-only-medusa-password@127.0.0.1:5432/medusa_db";

  validateMigrationDbGuard({
    apply: options.apply,
    confirmDatabase: options.confirmDatabase,
    allowProduction: options.allowProduction,
    databaseUrl,
  });

  const batchSize = options.batchSize ?? 200;
  const includeGuests = Boolean(options.includeGuests);
  const report = new MigrationReportWriter();
  const seenEmails = new Set<string>();

  const result: ImportCustomersResult = {
    dryRun: !options.apply,
    totalRows: 0,
    wouldCreateRegistered: 0,
    wouldCreateGuests: 0,
    createdRegistered: 0,
    createdGuests: 0,
    skippedDuplicates: 0,
    skippedExisting: 0,
    skippedGuests: 0,
    invalidRows: 0,
    algorithms: {
      "wp-bcrypt-sha384": 0,
      bcrypt: 0,
      phpass: 0,
      md5: 0,
      unsupported: 0,
      missing: 0,
    },
    peakHeapMb: 0,
  };

  let pool: pg.Pool | null = null;
  if (options.apply) {
    const req = createRequire(path.resolve(process.cwd(), "apps/medusa/package.json"));
    const pgMod = req("pg") as typeof import("pg");
    pool = new pgMod.Pool({ connectionString: databaseUrl, max: 4 });
  }
  let batch: PreparedCustomerRow[] = [];

  const flushBatch = async (items: PreparedCustomerRow[]): Promise<void> => {
    if (items.length === 0) return;

    if (!pool) {
      for (const item of items) {
        if (item.isGuest) {
          result.wouldCreateGuests += 1;
        } else {
          result.wouldCreateRegistered += 1;
        }
      }
      return;
    }

    await runBatchTransaction(pool, items, async (client, txItems) => {
      const emails = txItems.map((i) => i.email);
      const existingRes = await client.query<{ email: string; has_account: boolean }>(
        `SELECT LOWER(email) AS email, has_account FROM customer WHERE LOWER(email) = ANY($1) AND deleted_at IS NULL`,
        [emails],
      );

      const existingRegistered = new Set<string>();
      const existingGuests = new Set<string>();
      for (const r of existingRes.rows) {
        if (r.has_account) existingRegistered.add(r.email);
        else existingGuests.add(r.email);
      }

      const now = new Date();

      for (const item of txItems) {
        if (item.isGuest) {
          if (existingRegistered.has(item.email) || existingGuests.has(item.email)) {
            result.skippedExisting += 1;
            report.add({
              rowNumber: item.rowNumber,
              code: existingRegistered.has(item.email)
                ? "existing_account_skipped"
                : "existing_guest_skipped",
              maskedEmail: item.maskedEmail,
            });
            continue;
          }

          const customerId = `cus_${crypto.randomUUID().replace(/-/g, "")}`;
          await client.query(
            `INSERT INTO customer (id, email, first_name, last_name, phone, has_account, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, false, $6::jsonb, $7, $7)`,
            [
              customerId,
              item.email,
              item.firstName,
              item.lastName,
              item.phone,
              JSON.stringify({ migrated_from: "woocommerce", wc_guest: true }),
              now,
            ],
          );

          for (const addr of item.addresses) {
            await client.query(
              `INSERT INTO customer_address (id, customer_id, address_name, is_default_shipping, is_default_billing, company, first_name, last_name, address_1, address_2, city, country_code, province, postal_code, phone, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
              [
                `cuaddr_${crypto.randomUUID().replace(/-/g, "")}`,
                customerId,
                addr.addressName,
                addr.isDefaultShipping,
                addr.isDefaultBilling,
                addr.company,
                addr.firstName,
                addr.lastName,
                addr.address1,
                addr.address2,
                addr.city,
                addr.countryCode,
                addr.province,
                addr.postalCode,
                addr.phone,
                now,
              ],
            );
          }

          existingGuests.add(item.email);
          result.createdGuests += 1;
          continue;
        }

        // Registered customer: never overwrite an existing has_account=true customer
        if (existingRegistered.has(item.email)) {
          result.skippedExisting += 1;
          report.add({
            rowNumber: item.rowNumber,
            code: "existing_account_skipped",
            maskedEmail: item.maskedEmail,
          });
          continue;
        }

        const customerId = `cus_${crypto.randomUUID().replace(/-/g, "")}`;
        await client.query(
          `INSERT INTO customer (id, email, first_name, last_name, phone, has_account, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, true, $6::jsonb, $7, $7)`,
          [
            customerId,
            item.email,
            item.firstName,
            item.lastName,
            item.phone,
            JSON.stringify({
              migrated_from: "woocommerce",
              ...(item.wcUserId ? { wc_user_id: item.wcUserId } : {}),
              ...(item.wcRegisteredAt ? { wc_registered_at: item.wcRegisteredAt } : {}),
            }),
            now,
          ],
        );

        for (const addr of item.addresses) {
          await client.query(
            `INSERT INTO customer_address (id, customer_id, address_name, is_default_shipping, is_default_billing, company, first_name, last_name, address_1, address_2, city, country_code, province, postal_code, phone, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
            [
              `cuaddr_${crypto.randomUUID().replace(/-/g, "")}`,
              customerId,
              addr.addressName,
              addr.isDefaultShipping,
              addr.isDefaultBilling,
              addr.company,
              addr.firstName,
              addr.lastName,
              addr.address1,
              addr.address2,
              addr.city,
              addr.countryCode,
              addr.province,
              addr.postalCode,
              addr.phone,
              now,
            ],
          );
        }

        await client.query(
          `INSERT INTO customer_account_state (id, customer_id, email_verified_at, created_at, updated_at)
           VALUES ($1, $2, NULL, $3, $3)`,
          [`cas_${crypto.randomUUID().replace(/-/g, "")}`, customerId, now],
        );

        if (item.algorithm && item.rawHash) {
          const emailLookup = hashEmailLookup(item.email, options.encryptionKey);
          const hashEncrypted = encryptLegacyHash(item.rawHash, options.encryptionKey);
          await client.query(
            `INSERT INTO customer_legacy_credential (id, customer_id, email_lookup, algorithm, hash_encrypted, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $6)`,
            [
              `clc_${crypto.randomUUID().replace(/-/g, "")}`,
              customerId,
              emailLookup,
              item.algorithm,
              hashEncrypted,
              now,
            ],
          );
        }

        existingRegistered.add(item.email);
        result.createdRegistered += 1;
      }
    });
  };

  try {
    await streamCsvRecords(options.csvPath, async (row, rowNumber) => {
      result.totalRows += 1;

      const rawEmail = row.email ?? "";
      const email = normalizeEmail(rawEmail);
      const masked = maskEmail(email);

      if (!isValidEmail(email)) {
        result.invalidRows += 1;
        report.add({ rowNumber, code: "invalid_email", maskedEmail: masked, field: "email" });
        return;
      }

      const wcUserIdRaw = (row.wc_user_id ?? "").trim();
      const rawHash = (row.password_hash ?? "").trim();
      const isGuest = (wcUserIdRaw === "" || wcUserIdRaw === "0") && rawHash === "";

      if (isGuest && !includeGuests) {
        result.skippedGuests += 1;
        return;
      }

      if (seenEmails.has(email)) {
        result.skippedDuplicates += 1;
        report.add({ rowNumber, code: "duplicate_in_file", maskedEmail: masked });
        return;
      }
      seenEmails.add(email);

      const firstNameRes = sanitizeTextField(row.first_name, 100);
      const lastNameRes = sanitizeTextField(row.last_name, 100);
      if (firstNameRes.invalid || lastNameRes.invalid) {
        result.invalidRows += 1;
        report.add({ rowNumber, code: "control_char", maskedEmail: masked });
        return;
      }
      if (firstNameRes.truncated || lastNameRes.truncated) {
        report.add({ rowNumber, code: "oversized_field", maskedEmail: masked });
      }

      const phoneRes = sanitizePhone(row.phone);
      if (phoneRes.malformed) {
        report.add({ rowNumber, code: "malformed_phone", maskedEmail: masked, field: "phone" });
      }

      const firstName = escapeCsvFormula(firstNameRes.value || "Müşteri");
      const lastName = escapeCsvFormula(lastNameRes.value || "");

      const addresses: ParsedAddress[] = [];
      const billing = parseAddress(row, "billing_", firstName, lastName, rowNumber, masked, report);
      if (billing) addresses.push(billing);
      const shipping = parseAddress(
        row,
        "shipping_",
        firstName,
        lastName,
        rowNumber,
        masked,
        report,
      );
      if (shipping) addresses.push(shipping);

      let algorithm: LegacyAlgorithm | null = null;
      if (!isGuest) {
        if (!rawHash) {
          result.algorithms.missing += 1;
          report.add({
            rowNumber,
            code: "missing_hash",
            maskedEmail: masked,
            field: "password_hash",
          });
        } else {
          algorithm = detectLegacyAlgorithm(rawHash);
          if (algorithm) {
            result.algorithms[algorithm] += 1;
          } else {
            result.algorithms.unsupported += 1;
            report.add({
              rowNumber,
              code: "unsupported_hash",
              maskedEmail: masked,
              field: "password_hash",
            });
          }
        }
      }

      batch.push({
        rowNumber,
        email,
        maskedEmail: masked,
        isGuest,
        wcUserId: wcUserIdRaw && wcUserIdRaw !== "0" ? wcUserIdRaw : null,
        wcRegisteredAt: sanitizeTextField(row.user_registered, 64).value || null,
        firstName,
        lastName,
        phone: phoneRes.value,
        algorithm,
        rawHash,
        addresses,
      });

      if (batch.length >= batchSize) {
        await flushBatch(batch);
        batch = [];
        const heapMb = Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 10) / 10;
        if (heapMb > result.peakHeapMb) result.peakHeapMb = heapMb;
      }
    });

    if (batch.length > 0) {
      await flushBatch(batch);
      batch = [];
    }
    const heapMb = Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 10) / 10;
    if (heapMb > result.peakHeapMb) result.peakHeapMb = heapMb;
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  if (options.writeReport !== false) {
    result.reportPath = report.write("customers", {
      dryRun: result.dryRun,
      totalRows: result.totalRows,
      wouldCreateRegistered: result.wouldCreateRegistered,
      wouldCreateGuests: result.wouldCreateGuests,
      createdRegistered: result.createdRegistered,
      createdGuests: result.createdGuests,
      skippedDuplicates: result.skippedDuplicates,
      skippedExisting: result.skippedExisting,
      skippedGuests: result.skippedGuests,
      invalidRows: result.invalidRows,
      algorithms: result.algorithms,
      peakHeapMb: result.peakHeapMb,
    });
  }

  return result;
}

function parseCliArgs(argv: string[]): ImportCustomersOptions {
  let csvPath = "";
  let apply = false;
  let confirmDatabase: string | undefined;
  let allowProduction = false;
  let includeGuests = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--allow-production") allowProduction = true;
    else if (arg === "--include-guests") includeGuests = true;
    else if (arg === "--confirm-database" && argv[i + 1]) confirmDatabase = argv[++i];
    else if (arg.startsWith("--confirm-database="))
      confirmDatabase = arg.slice("--confirm-database=".length);
    else if (arg === "--file" && argv[i + 1]) csvPath = argv[++i];
    else if (arg.startsWith("--file=")) csvPath = arg.slice("--file=".length);
    else if (!arg.startsWith("--") && !csvPath) csvPath = arg;
  }

  if (!csvPath) {
    throw new Error(
      "Kullanım: pnpm migrate:customers -- <csv_yolu> [--apply --confirm-database <db>] [--include-guests] [--allow-production]",
    );
  }

  return {
    csvPath: path.resolve(process.cwd(), csvPath),
    apply,
    confirmDatabase,
    allowProduction,
    includeGuests,
  };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

function loadEnvIfPresent(relPath: string): void {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = rawVal;
    }
  }
}

if (isMain) {
  loadEnvIfPresent("apps/medusa/.env");
  loadEnvIfPresent(".env");

  const opts = parseCliArgs(process.argv.slice(2));
  importCustomersFromCsv(opts)
    .then((res) => {
      console.log(JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error("HATA:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}

export { formatMaskedReportLine };
