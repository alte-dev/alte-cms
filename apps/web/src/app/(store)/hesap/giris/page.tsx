import { redirect } from "next/navigation";
import { LoginForm } from "../../../../components/account/LoginForm";
import { getServerCustomer } from "../../../../lib/medusa/account";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const customer = await getServerCustomer();
  if (customer) {
    redirect("/hesap");
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="rounded-xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Giriş Yap</h1>
        <p className="text-sm text-stone-600 mb-6">
          Siparişlerinizi ve adreslerinizi yönetmek için hesabınıza giriş yapın.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
