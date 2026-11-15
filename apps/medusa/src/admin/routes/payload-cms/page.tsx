import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useEffect } from "react";

const PayloadCmsRedirectPage = () => {
  useEffect(() => {
    window.location.href = "/api/admin/switch-to-payload";
  }, []);

  return (
    <div style={{ padding: "24px", fontSize: "14px" }}>
      <p>İçerik Yönetimi (Payload CMS) paneline yönlendiriliyorsunuz...</p>
      <a
        href="/api/admin/switch-to-payload"
        style={{ textDecoration: "underline", fontWeight: 600 }}
      >
        Otomatik yönlendirme başlamazsa tıklayın
      </a>
    </div>
  );
};

export const config = defineRouteConfig({
  label: "İçerik Yönetimi (/admin)",
});

export default PayloadCmsRedirectPage;
