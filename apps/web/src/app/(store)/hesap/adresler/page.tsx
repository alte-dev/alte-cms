import { redirect } from "next/navigation";
import { AccountShell } from "../../../../components/account/AccountShell";
import { AddressesManager } from "../../../../components/account/AddressesManager";
import { getServerCustomer, getServerCustomerAddresses } from "../../../../lib/medusa/account";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const customer = await getServerCustomer();
  if (!customer) {
    redirect("/hesap/giris");
  }

  const addresses = await getServerCustomerAddresses();
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Müşteri";

  return (
    <AccountShell customerName={fullName} emailVerified={customer.email_verified}>
      <AddressesManager initialAddresses={addresses} />
    </AccountShell>
  );
}
