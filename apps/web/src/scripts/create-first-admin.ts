/**
 * One-time CLI script to bootstrap the initial super-admin user in Payload CMS.
 * Usage:
 *   pnpm --filter @alte/web create-admin <email> <password>
 */
import configPromise from "@payload-config";
import { getPayload } from "payload";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];

  if (!email || !password) {
    console.error("❌ Kullanım: pnpm --filter @alte/web create-admin <email> <password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Hata: Parola en az 8 karakter olmalıdır.");
    process.exit(1);
  }

  const payload = await getPayload({ config: configPromise });

  // Check if any users exist
  const existing = await payload.find({
    collection: "users",
    limit: 1,
  });

  if (existing.totalDocs > 0) {
    console.error(
      "⚠️ Hata: Sistemde halihazırda kullanıcı bulunmaktadır. Yeni kullanıcı eklemek için mevcut bir admin ile panel üzerinden ekleyin.",
    );
    process.exit(1);
  }

  console.log(`👤 İlk Süper Admin oluşturuluyor: ${email}...`);
  await payload.create({
    collection: "users",
    data: {
      email,
      password,
      name: "Süper Admin",
      role: "super-admin",
    },
  });

  console.log("✅ İlk Süper Admin başarıyla oluşturuldu.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Admin oluşturma hatası:", err);
  process.exit(1);
});
