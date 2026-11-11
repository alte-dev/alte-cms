import { chromium, type Browser, type LaunchOptions } from "playwright";

export interface RecordedStepResult {
  step: number | string;
  name: string;
  passed: boolean;
  details: string;
  detail: string;
  title: string;
  success: boolean;
}

export interface StepRecorderOptions {
  exitOnFail?: boolean;
  format?: "adim" | "step" | "check" | "quality";
}

/**
 * AGENTS.md §5:
 * "Bir adımın detayında 'beklenen X, gelen Y' yazıyorsa adım PASS olamaz."
 * Throws if `passed === true` while `details` contains a mismatching Expected vs Actual pair.
 */
export function assertNoMismatchPass(passed: boolean, details: string): void {
  if (!passed || !details) return;

  const patterns = [
    /beklenen\s*:?\s*([^,;]+?)\s*,\s*gelen\s*:?\s*([^.,;\n)]+)/gi,
    /expected\s*:?\s*([^,;]+?)\s*,\s*(?:got|received)\s*:?\s*([^.,;\n)]+)/gi,
  ];

  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(details)) !== null) {
      const expected = match[1].trim().replace(/^["'`]|["'`]$/g, "");
      const actual = match[2].trim().replace(/^["'`]|["'`]$/g, "");
      if (expected !== actual) {
        throw new Error(
          `[AGENTS.md §5 İhlali] Detayda beklenen (${expected}) ve gelen (${actual}) farklıyken adım PASS olarak işaretlenemez: "${details}"`,
        );
      }
    }
  }
}

export function createStepRecorder(options: StepRecorderOptions = {}) {
  const { exitOnFail = false, format = "adim" } = options;
  const results: RecordedStepResult[] = [];

  function recordStep(
    stepOrTitle: number | string,
    nameOrPassed: string | boolean,
    passedOrDetails: boolean | string,
    maybeDetails?: string,
  ): RecordedStepResult {
    let step: number | string;
    let name: string;
    let passed: boolean;
    let details: string;

    if (typeof nameOrPassed === "boolean" && typeof passedOrDetails === "string") {
      // 3-arg signature: recordCheck(title, passed, details)
      step = results.length + 1;
      name = String(stepOrTitle);
      passed = nameOrPassed;
      details = passedOrDetails;
    } else {
      // 4-arg signature: recordStep(step, name, passed, details)
      step = stepOrTitle;
      name = String(nameOrPassed);
      passed = Boolean(passedOrDetails);
      details = String(maybeDetails ?? "");
    }

    assertNoMismatchPass(passed, details);

    const entry: RecordedStepResult = {
      step,
      name,
      passed,
      details,
      detail: details,
      title: name,
      success: passed,
    };
    results.push(entry);

    if (format === "check") {
      const icon = passed ? "✅" : "❌";
      console.log(`${icon} [${passed ? "GEÇTİ" : "BAŞARISIZ"}] ${name}: ${details}`);
    } else if (format === "step") {
      const status = passed ? "✅ PASS" : "❌ FAIL";
      console.log(`[Step ${step}] ${status} - ${name}: ${details}`);
    } else if (format === "quality") {
      const status = passed ? "PASS" : "FAIL";
      console.log(`[Adım ${step}] ${status}: ${name}`);
      if (details) {
        console.log(`    Detay: ${details}`);
      }
    } else {
      const icon = passed ? "✅" : "❌";
      console.log(`${icon} [Adım ${step}] ${name}: ${details}`);
    }

    if (!passed && exitOnFail) {
      console.error(`\n❌ FAILED: Adım ${step} (${name})`);
      console.error(`Ayrıntı: ${details}`);
      process.exit(1);
    }

    return entry;
  }

  return {
    results,
    recordStep,
  };
}

/**
 * Shared Playwright Chromium launcher for scripts/ that respects CHROME_PATH
 * or falls back to Playwright's installed Chromium binary.
 */
export function resolveScriptChromiumOptions(
  env: Record<string, string | undefined> = process.env,
  extraArgs: string[] = [],
): LaunchOptions {
  const chromePath = env.CHROME_PATH?.trim() ? env.CHROME_PATH.trim() : undefined;
  return {
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", ...extraArgs],
  };
}

export async function launchVerifyBrowser(extraArgs: string[] = []): Promise<Browser> {
  return chromium.launch(resolveScriptChromiumOptions(process.env, extraArgs));
}
