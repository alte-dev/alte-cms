import React from "react";
import Link from "next/link";
import { ShoppingBag, ShieldCheck, User, Search } from "lucide-react";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          backgroundColor: "#0284c7",
          color: "#ffffff",
          padding: "6px 16px",
          textAlign: "center",
          fontSize: "13px",
          fontWeight: "500",
        }}
      >
        <span>
          Tüm siparişlerde kargo fırsatları • Güvenli Ödeme (PayTR) • Fiyatlarımıza KDV dahildir
        </span>
      </div>

      {/* Main Navbar */}
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
          }}
        >
          {/* Brand */}
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "22px",
                fontWeight: "800",
                letterSpacing: "-0.5px",
                color: "#0369a1",
              }}
            >
              ALTE
            </span>
            <span
              style={{
                fontSize: "14px",
                fontWeight: "600",
                textTransform: "uppercase",
                backgroundColor: "#e0f2fe",
                color: "#0369a1",
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              Store
            </span>
          </Link>

          {/* Search Box Placeholder */}
          <div style={{ flex: 1, maxWidth: "480px", position: "relative" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px 12px",
                backgroundColor: "#f1f5f9",
              }}
            >
              <Search size={18} color="#64748b" style={{ marginRight: "8px" }} />
              <input
                type="text"
                placeholder="Ürün, kategori veya marka ara..."
                disabled
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                  color: "#475569",
                }}
              />
            </div>
          </div>

          {/* Action Links */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link
              href="/admin"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                color: "#475569",
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              <ShieldCheck size={16} />
              <span>Yönetim Paneli</span>
            </Link>

            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                color: "#334155",
              }}
            >
              <User size={18} />
              <span>Giriş Yap</span>
            </button>

            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <ShoppingBag size={18} />
              <span>Sepetim (0,00 ₺)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>{children}</main>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: "#0f172a",
          color: "#94a3b8",
          padding: "48px 20px 24px 20px",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "32px",
          }}
        >
          <div>
            <h4
              style={{
                color: "#f8fafc",
                fontSize: "16px",
                marginBottom: "12px",
                fontWeight: "700",
              }}
            >
              ALTE E-Ticaret
            </h4>
            <p style={{ fontSize: "13px", lineHeight: "1.6" }}>
              Medusa v2 ve Payload CMS 3 altyapısıyla güçlendirilmiş, yüksek performanslı ve güvenli
              yeni nesil mağaza.
            </p>
          </div>
          <div>
            <h4
              style={{
                color: "#f8fafc",
                fontSize: "16px",
                marginBottom: "12px",
                fontWeight: "700",
              }}
            >
              Müşteri Hizmetleri
            </h4>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                fontSize: "13px",
                lineHeight: "2",
              }}
            >
              <li>Sıkça Sorulan Sorular</li>
              <li>Kargo ve Teslimat</li>
              <li>İade ve Değişim Koşulları</li>
              <li>Gizlilik ve Güvenlik</li>
            </ul>
          </div>
          <div>
            <h4
              style={{
                color: "#f8fafc",
                fontSize: "16px",
                marginBottom: "12px",
                fontWeight: "700",
              }}
            >
              Güvenli Alışveriş
            </h4>
            <p style={{ fontSize: "13px", lineHeight: "1.6" }}>
              Tüm işlemler 256-bit SSL sertifikası ile korunmaktadır. PayTR 3D Secure ve Kapıda
              Ödeme seçenekleri desteklenmektedir.
            </p>
          </div>
        </div>

        <div
          style={{
            maxWidth: "1200px",
            margin: "32px auto 0 auto",
            paddingTop: "20px",
            borderTop: "1px solid #1e293b",
            textAlign: "center",
            fontSize: "12px",
          }}
        >
          © {new Date().getFullYear()} ALTE CMS. Tüm hakları saklıdır. Para Birimi: Türk Lirası (₺)
          • KDV Dahil
        </div>
      </footer>
    </div>
  );
}
