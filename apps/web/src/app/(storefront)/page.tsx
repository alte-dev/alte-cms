import React from "react";
import { getMedusaProducts } from "@/lib/medusa";
import { PackageOpen, Server, CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products, connected, error } = await getMedusaProducts();

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
      {/* Backend Status Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          borderRadius: "8px",
          marginBottom: "32px",
          backgroundColor: connected ? "#f0fdf4" : "#fffbeb",
          border: `1px solid ${connected ? "#bbf7d0" : "#fef08a"}`,
          fontSize: "13px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Server size={16} color={connected ? "#16a34a" : "#ca8a04"} />
          <span style={{ fontWeight: "600", color: connected ? "#166534" : "#854d0e" }}>
            Medusa Ticaret Motoru:
          </span>
          <span style={{ color: connected ? "#15803d" : "#a16207" }}>
            {connected
              ? "127.0.0.1:9000 üzerinden başarıyla bağlandı"
              : `Bağlantı bekleniyor (${error || "Servis henüz aktif değil"})`}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {connected ? (
            <>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ color: "#166534", fontWeight: "500" }}>Aktif</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} color="#ca8a04" />
              <span style={{ color: "#854d0e", fontWeight: "500" }}>Beklemede</span>
            </>
          )}
        </div>
      </div>

      {/* Hero Welcome */}
      <section style={{ textAlign: "center", marginBottom: "48px" }}>
        <h1
          style={{
            fontSize: "36px",
            fontWeight: "800",
            color: "#0f172a",
            marginBottom: "12px",
            letterSpacing: "-0.5px",
          }}
        >
          Yeni Nesil E-Ticaret Deneyimi
        </h1>
        <p
          style={{
            fontSize: "16px",
            color: "#64748b",
            maxWidth: "640px",
            margin: "0 auto",
            lineHeight: "1.6",
          }}
        >
          Medusa v2 mimarisi ve Payload CMS esnekliğiyle güçlendirilmiş mağazamıza hoş geldiniz.
        </p>
      </section>

      {/* Catalog Display */}
      {products.length === 0 ? (
        /* Empty State */
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "2px dashed #cbd5e1",
            borderRadius: "16px",
            padding: "64px 24px",
            textAlign: "center",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              backgroundColor: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
            }}
          >
            <PackageOpen size={36} color="#64748b" />
          </div>
          <h2
            style={{ fontSize: "20px", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}
          >
            Mağazamızda Henüz Ürün Bulunmuyor
          </h2>
          <p
            style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}
          >
            Katalog ve ürün giriş hazırlıkları devam etmektedir. Yönetim paneli veya seed komutu
            üzerinden yeni ürünler ekleyebilirsiniz.
          </p>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            Geliştirici İpucu: <code>pnpm seed:fake</code> komutunu çalıştırarak Medusa veritabanına
            test kataloğu yükleyebilirsiniz.
          </div>
        </div>
      ) : (
        /* Products Grid */
        <div>
          <h2
            style={{ fontSize: "22px", fontWeight: "700", color: "#0f172a", marginBottom: "24px" }}
          >
            Öne Çıkan Ürünler ({products.length})
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "24px",
            }}
          >
            {products.map((product) => {
              const defaultVariant = product.variants?.[0];
              const price = defaultVariant?.prices?.[0];
              const formattedPrice = price
                ? new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                  }).format(price.amount)
                : "Fiyat Belirtilmedi";

              return (
                <div
                  key={product.id}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      height: "200px",
                      backgroundColor: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: "13px",
                    }}
                  >
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt={product.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      "Görsel Yok"
                    )}
                  </div>
                  <div
                    style={{ padding: "16px", display: "flex", flexDirection: "column", flex: 1 }}
                  >
                    <h3
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#1e293b",
                        marginBottom: "8px",
                      }}
                    >
                      {product.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        lineHeight: "1.4",
                        marginBottom: "16px",
                        flex: 1,
                      }}
                    >
                      {product.description || "Ürün açıklaması henüz girilmedi."}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "12px",
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#0284c7" }}>
                        {formattedPrice}
                      </span>
                      <button
                        type="button"
                        style={{
                          backgroundColor: "#0f172a",
                          color: "#ffffff",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "13px",
                          fontWeight: "500",
                          cursor: "pointer",
                        }}
                      >
                        İncele
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
