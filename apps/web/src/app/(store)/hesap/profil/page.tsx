import { redirect } from "next/navigation";
import { AccountShell } from "../../../../components/account/AccountShell";
import { ProfileForm } from "../../../../components/account/ProfileForm";
import { getServerCustomer } from "../../../../lib/medusa/account";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const customer = await getServerCustomer();
  if (!customer) {
    redirect("/hesap/giris");
  }
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Müşteri";

  return (
    <AccountShell customerName={fullName} emailVerified={customer.email_verified}>
      <ProfileForm initialCustomer={customer} />
    </AccountShell>
  );
}
