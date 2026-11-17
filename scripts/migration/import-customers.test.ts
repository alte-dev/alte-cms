import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { streamCsvRecords } from "./csv-stream";
import { validateMigrationDbGuard } from "./db-guard";
import { importCustomersFromCsv } from "./import-customers";
import { formatMaskedReportLine } from "./report";
import { escapeCsvFormula, maskEmail, normalizeEmail, sanitizeTextField } from "./sanitize";

const tempDirs: string[] = [];

function makeTempFile(name: string, content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alte-mig-test-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

afterEach(() => {
  for (const d of tempDirs.splice(0)) {
    fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("migration sanitize & masking", () => {
  it("normalizes email and masks PII safely", () => {
    expect(normalizeEmail("  Ali.Veli@Example.TEST  ")).toBe("ali.veli@example.test");
    expect(maskEmail("ali@example.test")).toBe("a***@e***.test");
    expect(maskEmail("x@y.com")).toBe("x***@y***.com");
    expect(maskEmail("invalid")).toBe("***");
  });

  it("neutralizes CSV formula injection prefixes", () => {
    expect(escapeCsvFormula("=CMD()")).toBe("'=CMD()");
    expect(escapeCsvFormula("+1234")).toBe("'+1234");
    expect(escapeCsvFormula("-1234")).toBe("'-1234");
    expect(escapeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvFormula("Normal Ad")).toBe("Normal Ad");
  });

  it("rejects NUL bytes and truncates oversized fields while preserving Turkish chars", () => {
    expect(sanitizeTextField("İsmail Şahin ğüö", 100)).toEqual({
      value: "İsmail Şahin ğüö",
      truncated: false,
      invalid: false,
    });
    expect(sanitizeTextField("bad\0text", 100).invalid).toBe(true);
    expect(sanitizeTextField("x".repeat(150), 100)).toEqual({
      value: "x".repeat(100),
      truncated: true,
      invalid: false,
    });
  });

  it("never includes raw email or hash in masked report lines", () => {
    const line = formatMaskedReportLine({
      rowNumber: 4,
      code: "unsupported_hash",
      maskedEmail: "u***@e***.test",
      field: "password_hash",
    });
    expect(line).toContain("row=4");
    expect(line).toContain("unsupported_hash");
    expect(line).toContain("u***@e***.test");
    expect(line).not.toContain("$wp$");
  });
});

describe("db-guard", () => {
  it("allows dry-run without confirmDatabase", () => {
    expect(() =>
      validateMigrationDbGuard({
        apply: false,
        databaseUrl: "postgres://u:p@127.0.0.1:5432/medusa_db",
      }),
    ).not.toThrow();
  });

  it("blocks --apply when confirmDatabase is missing or mismatched", () => {
    expect(() =>
      validateMigrationDbGuard({
        apply: true,
        databaseUrl: "postgres://u:p@127.0.0.1:5432/medusa_db",
      }),
    ).toThrow(/confirm-database/i);

    expect(() =>
      validateMigrationDbGuard({
        apply: true,
        confirmDatabase: "wrong_db",
        databaseUrl: "postgres://u:p@127.0.0.1:5432/medusa_db",
      }),
    ).toThrow(/mismatch|eşleşmiyor/i);

    expect(() =>
      validateMigrationDbGuard({
        apply: true,
        confirmDatabase: "medusa_db",
        databaseUrl: "postgres://u:p@127.0.0.1:5432/medusa_db",
        nodeEnv: "development",
      }),
    ).not.toThrow();
  });

  it("blocks --apply in production without --allow-production", () => {
    expect(() =>
      validateMigrationDbGuard({
        apply: true,
        confirmDatabase: "medusa_db",
        databaseUrl: "postgres://u:p@127.0.0.1:5432/medusa_db",
        nodeEnv: "production",
        allowProduction: false,
      }),
    ).toThrow(/allow-production/i);
  });
});

describe("csv-stream", () => {
  it("streams UTF-8 BOM, quoted commas, and multiline fields", async () => {
    const csv =
      '\uFEFFwc_user_id,email,first_name,last_name\n1,a@example.test,"İsmail, Bey","Şahin"\n2,b@example.test,"Line1\nLine2",Öztürk\n';
    const file = makeTempFile("customers.csv", csv);
    const rows: Array<Record<string, string>> = [];
    const count = await streamCsvRecords(file, (row) => {
      rows.push(row);
    });
    expect(count).toBe(2);
    expect(rows[0].first_name).toBe("İsmail, Bey");
    expect(rows[1].first_name).toBe("Line1\nLine2");
  });
});

describe("importCustomersFromCsv (dry-run & idempotency)", () => {
  it("counts algorithms, skips duplicates, and respects --include-guests in dry-run", async () => {
    const csv = [
      "wc_user_id,email,first_name,last_name,phone,billing_address_1,billing_city,billing_country,password_hash",
      "101,wp@example.test,Ayşe,Yılmaz,+905551112233,İstiklal Cad 1,İstanbul,TR,$wp$2y$10$abcdefghijklmnopqrstuv1234567890123456789012345678901",
      "102,phpass@example.test,Mehmet,Kaya,bad-phone!,Atatürk Blv 2,Ankara,TR,$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      "103,md5@example.test,Fatma,Demir,,Cumhuriyet 3,İzmir,TR,5d41402abc4b2a76b9719d911017c592",
      "104,WP@example.test,Dup,User,,,,,$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      "105,unknown@example.test,Ali,Can,,,,,$argon2id$v=19$m=65536,t=3,p=1$abc$def",
      "106,nohash@example.test,Veli,Öz,,,,,",
      "0,guest@example.test,Misafir,Müşteri,,,,,",
      "0,wp@example.test,GuestDup,OfRegistered,,,,,",
    ].join("\n");
    const file = makeTempFile("import.csv", csv);

    const dryDefault = await importCustomersFromCsv({
      csvPath: file,
      apply: false,
      includeGuests: false,
      writeReport: false,
    });
    expect(dryDefault.totalRows).toBe(8);
    expect(dryDefault.wouldCreateRegistered).toBe(5);
    expect(dryDefault.wouldCreateGuests).toBe(0);
    expect(dryDefault.skippedDuplicates).toBe(1);
    expect(dryDefault.skippedGuests).toBe(2);
    expect(dryDefault.algorithms["wp-bcrypt-sha384"]).toBe(1);
    expect(dryDefault.algorithms.phpass).toBe(1);
    expect(dryDefault.algorithms.md5).toBe(1);
    expect(dryDefault.algorithms.unsupported).toBe(1);
    expect(dryDefault.algorithms.missing).toBe(1);

    const dryWithGuests = await importCustomersFromCsv({
      csvPath: file,
      apply: false,
      includeGuests: true,
      writeReport: false,
    });
    expect(dryWithGuests.wouldCreateRegistered).toBe(5);
    expect(dryWithGuests.wouldCreateGuests).toBe(1); // guest@example.test; wp@example.test already registered
    expect(dryWithGuests.skippedDuplicates).toBe(2);
  });
});
