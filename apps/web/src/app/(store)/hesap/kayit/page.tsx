import { redirect } from "next/navigation";
import { RegisterForm } from "../../../../components/account/RegisterForm";
import { getServerCustomer } from "../../../../lib/medusa/account";
import { sanitizeRedirectPath } from "../../../../lib/medusa/safe-redirect";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const redirectTo = sanitizeRedirectPath(params.redirect, "/hesap");

  const customer = await getServerCustomer();
  if (customer) {
    redirect(redirectTo);
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Hesap Oluştur</h1>
        <p className="text-sm text-stone-600 mb-6">
          Sipariş takibi ve hızlı teslimat için yeni bir müşteri hesabı oluşturun.
        </p>
        <RegisterForm redirectTo={redirectTo} />
      </div>
    </div>
  );
}
