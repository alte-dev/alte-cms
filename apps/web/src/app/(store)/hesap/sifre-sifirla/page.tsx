import { PasswordResetClient } from "../../../../components/account/PasswordResetClient";

export const dynamic = "force-dynamic";

export default async function PasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Şifre Sıfırlama</h1>
        <p className="text-sm text-stone-600 mb-6">
          {token
            ? "Hesabınız için yeni bir parola belirleyin."
            : "E-posta adresinize tek kullanımlık şifre sıfırlama bağlantısı gönderin."}
        </p>
        <PasswordResetClient token={token} />
      </div>
    </div>
  );
}
