import fs from "fs";
import path from "path";
import type { MigrationReportEntry } from "./types";

export function formatMaskedReportLine(entry: MigrationReportEntry): string {
  const fieldPart = entry.field ? ` field=${entry.field}` : "";
  return `row=${entry.rowNumber} code=${entry.code} email=${entry.maskedEmail}${fieldPart}`;
}

export class MigrationReportWriter {
  readonly entries: MigrationReportEntry[] = [];

  add(entry: MigrationReportEntry): void {
    this.entries.push(entry);
  }

  write(jobName: string, summary: Record<string, unknown>, baseDir = process.cwd()): string {
    const reportsDir = path.resolve(baseDir, "migration-data", "reports");
    fs.mkdirSync(reportsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(reportsDir, `${jobName}-${stamp}.json`);
    const payload = {
      job: jobName,
      generatedAt: new Date().toISOString(),
      summary,
      issues: this.entries.map((e) => ({
        rowNumber: e.rowNumber,
        code: e.code,
        maskedEmail: e.maskedEmail,
        ...(e.field ? { field: e.field } : {}),
      })),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    return filePath;
  }
}
