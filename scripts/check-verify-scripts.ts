/**
 * scripts/check-verify-scripts.ts
 *
 * Guard script for FAZ 11.5 Section 3.3:
 * Scans `scripts/verify-*.ts` for the anti-pattern of reading source files via
 * `readFileSync` and checking `.includes(` to produce fake "PASS" results.
 * Legitimate build-artifact checks (e.g. `.next/app-build-manifest.json` or `.next/static/chunks`)
 * must be explicitly listed in `scripts/verify-lint-allow.json`.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export type VerifyLintAllowlist = Record<string, string[]>;

export interface VerifyScriptViolation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

export function scanVerifyScriptSource(
  fileName: string,
  source: string,
  allowlist: VerifyLintAllowlist = {},
): VerifyScriptViolation[] {
  const violations: VerifyScriptViolation[] = [];
  const lines = source.split(/\r?\n/);
  const allowedEntries = allowlist[fileName] || [];
  const hasIncludes = /\.includes\s*\(/.test(source);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    if (/\breadFileSync\s*\(/.test(line) && hasIncludes) {
      const isAllowed = allowedEntries.some(
        (entry) => line.includes(entry) || entry === "*" || entry === "Build manifest check",
      );
      if (!isAllowed) {
        violations.push({
          file: fileName,
          line: i + 1,
          snippet: trimmed,
          reason:
            "verify-*.ts içinde readFileSync + .includes() kullanımı tespit edildi (AGENTS.md §5: kaynak kodunda kelime arayarak doğrulama yasaktır).",
        });
      }
    }
  }

  return violations;
}

function main() {
  const scriptsDir = path.resolve(process.cwd(), "scripts");
  const allowlistPath = path.join(scriptsDir, "verify-lint-allow.json");

  let allowlist: VerifyLintAllowlist = {};
  if (fs.existsSync(allowlistPath)) {
    allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as VerifyLintAllowlist;
  }

  const files = fs
    .readdirSync(scriptsDir)
    .filter((f) => /^verify-.*\.ts$/.test(f) && f !== "verify-all.ts");

  const allViolations: VerifyScriptViolation[] = [];
  for (const file of files) {
    const fullPath = path.join(scriptsDir, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const fileViolations = scanVerifyScriptSource(file, content, allowlist);
    allViolations.push(...fileViolations);
  }

  if (allViolations.length > 0) {
    console.error(
      "❌ [check-verify-scripts] BAŞARISIZ: Doğrulama betiklerinde yasaklı readFileSync + .includes() kalıbı bulundu:",
    );
    for (const v of allViolations) {
      console.error(`   ${v.file}:${v.line} -> ${v.snippet}`);
      console.error(`      Neden: ${v.reason}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ [check-verify-scripts] GEÇTİ: ${files.length} doğrulama betiği tarandı, yasaklı kaynak kodu okuma kalıbı bulunmadı.`,
  );
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  main();
}
