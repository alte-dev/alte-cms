import { spawnSync } from "child_process";

// Check if gitleaks binary is accessible in PATH
const check = spawnSync(process.platform === "win32" ? "where" : "which", ["gitleaks"], {
  stdio: "ignore",
});

if (check.status !== 0) {
  console.error("❌ HATA: Gitleaks bulunamadı.");
  console.error(
    "Lütfen https://github.com/gitleaks/gitleaks adresinden kurun veya PATH ortam değişkenine ekleyin.",
  );
  process.exit(1);
}

// Run gitleaks protect
const result = spawnSync("gitleaks", ["protect", "--staged", "--verbose"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 0);
