import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ESLint } from "eslint";
import { assertNoMismatchPass, createStepRecorder } from "../../../../scripts/lib/verify-step";
import { checkQualityBaselineContent } from "../../../../scripts/check-quality-baseline";
import { scanVerifyScriptSource } from "../../../../scripts/check-verify-scripts";
import { runVerifyCommands } from "../../../../scripts/verify-all";

describe("FAZ 11.5 Section 3 — Verification Guards & Self-Tests", () => {
  describe("Guard 5: verify-step.ts 'Beklenen X, gelen Y' mismatch protection", () => {
    it("throws when passed=true but detail says 'Beklenen X, gelen Y' with X !== Y", () => {
      expect(() => assertNoMismatchPass(true, "Beklenen 200, gelen 500")).toThrow(
        /beklenen.*gelen/i,
      );

      expect(() =>
        assertNoMismatchPass(true, "Durum kontrolü: beklenen: 1500, gelen: 560."),
      ).toThrow(/beklenen.*gelen/i);

      const recorder = createStepRecorder({ exitOnFail: false });
      expect(() =>
        recorder.recordStep(1, "Yanlış PASS testi", true, "Beklenen 200, gelen 404"),
      ).toThrow(/beklenen.*gelen/i);
    });

    it("allows passed=true when 'Beklenen X, gelen X' matches or when passed=false on mismatch", () => {
      expect(() => assertNoMismatchPass(true, "Beklenen 200, gelen 200")).not.toThrow();

      expect(() => assertNoMismatchPass(false, "Beklenen 200, gelen 500")).not.toThrow();
    });
  });

  describe("Guard 1: ESLint forbids page.setContent in tests and scripts", () => {
    it("reports an ESLint error when page.setContent(...) is used in apps/web/src/tests/**", async () => {
      const eslint = new ESLint({
        cwd: path.resolve(__dirname, "../.."),
      });
      const fakeTestFile = path.resolve(__dirname, "fake-set-content-violation.test.ts");
      const results = await eslint.lintText(
        `export async function badTest(page: { setContent: (html: string) => Promise<void> }) {\n  await page.setContent("<html><body>Sahte</body></html>");\n}\n`,
        { filePath: fakeTestFile },
      );

      const messages = results.flatMap((r) => r.messages);
      const restrictedError = messages.find(
        (m) =>
          m.ruleId === "no-restricted-syntax" &&
          m.severity === 2 &&
          m.message.includes("setContent"),
      );
      expect(restrictedError).toBeDefined();
    });
  });

  describe("Guard 2: docs/QUALITY-BASELINE.md must not contain 'ölçülmedi'", () => {
    it("fails when markdown contains 'ölçülmedi' and passes on real baseline file", () => {
      const badCheck = checkQualityBaselineContent(
        "| Sayfa | Skor |\n| --- | --- |\n| `/odeme` | ölçülmedi |\n",
      );
      expect(badCheck.ok).toBe(false);
      expect(badCheck.matches.length).toBeGreaterThan(0);

      const realPath = path.resolve(__dirname, "../../../../docs/QUALITY-BASELINE.md");
      const realContent = fs.readFileSync(realPath, "utf8");
      const realCheck = checkQualityBaselineContent(realContent);
      expect(realCheck.ok).toBe(true);
      expect(realCheck.matches).toEqual([]);
    });
  });

  describe("Guard 3: scripts/verify-*.ts source-grep anti-pattern scanner", () => {
    it("flags unallowed readFileSync + .includes source-code checks and respects allowlist", () => {
      const badScript = `
        import fs from "fs";
        const src = fs.readFileSync("apps/web/src/app/page.tsx", "utf8");
        if (src.includes("skip-link")) {
          console.log("PASS");
        }
      `;
      const violations = scanVerifyScriptSource("verify-fake.ts", badScript, {});
      expect(violations.length).toBeGreaterThan(0);

      const allowedViolations = scanVerifyScriptSource("verify-fake.ts", badScript, {
        "verify-fake.ts": ["Build manifest check"],
      });
      expect(allowedViolations).toEqual([]);
    });
  });

  describe("Guard 4: Negative self-test for verify:all runner", () => {
    it("runs remaining scripts when one fails and returns non-zero exitCode", async () => {
      const os = await import("os");
      const fs = await import("fs");
      const tmpLogDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-all-test-"));

      try {
        const summary = await runVerifyCommands(
          [
            {
              name: "mock-pass-1",
              command: process.execPath,
              args: ["-e", "console.log('pass 1'); process.exit(0);"],
            },
            {
              name: "mock-fail-2",
              command: process.execPath,
              args: ["-e", "console.error('fail 2'); process.exit(1);"],
            },
            {
              name: "mock-pass-3",
              command: process.execPath,
              args: ["-e", "console.log('pass 3 after fail'); process.exit(0);"],
            },
          ],
          { logDir: tmpLogDir, quiet: true },
        );

        expect(summary.exitCode).toBe(1);
        expect(summary.results).toHaveLength(3);
        expect(summary.results[0].exitCode).toBe(0);
        expect(summary.results[1].exitCode).toBe(1);
        expect(summary.results[2].exitCode).toBe(0);
        expect(fs.existsSync(path.join(tmpLogDir, "SUMMARY.md"))).toBe(true);
      } finally {
        fs.rmSync(tmpLogDir, { recursive: true, force: true });
      }
    });
  });
});
