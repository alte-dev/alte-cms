/**
 * scripts/check-quality-baseline.ts
 *
 * Guard script for FAZ 11.5 Section 3.2:
 * Fails with exit code 1 if `docs/QUALITY-BASELINE.md` contains "ölçülmedi"
 * (case-insensitive).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface BaselineCheckResult {
  ok: boolean;
  matches: Array<{ line: number; text: string }>;
}

export function checkQualityBaselineContent(content: string): BaselineCheckResult {
  const lines = content.split(/\r?\n/);
  const matches: Array<{ line: number; text: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (/ölçülmedi|olculmedi/i.test(lineText)) {
      matches.push({ line: i + 1, text: lineText.trim() });
    }
  }

  return {
    ok: matches.length === 0,
    matches,
  };
}

function main() {
  const baselinePath = path.resolve(process.cwd(), "docs/QUALITY-BASELINE.md");
  if (!fs.existsSync(baselinePath)) {
    console.error(`❌ HATA: ${baselinePath} bulunamadı.`);
    process.exit(1);
  }

  const content = fs.readFileSync(baselinePath, "utf8");
  const result = checkQualityBaselineContent(content);

  if (!result.ok) {
    console.error(
      "❌ [check-quality-baseline] BAŞARISIZ: docs/QUALITY-BASELINE.md içinde 'ölçülmedi' ifadesi bulundu:",
    );
    for (const m of result.matches) {
      console.error(`   Satır ${m.line}: ${m.text}`);
    }
    process.exit(1);
  }

  console.log(
    "✅ [check-quality-baseline] GEÇTİ: docs/QUALITY-BASELINE.md içinde 'ölçülmedi' ifadesi yok.",
  );
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  main();
}
