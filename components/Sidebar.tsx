"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Film,
  Settings,
  Sparkles,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/brands", label: "Brands", icon: Building2 },
  { href: "/creatives", label: "Creatives", icon: Film },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      id="sidebar-nav"
      style={{
        width: "var(--sidebar-width)",
        height: "100vh",
        position: "fixed",
        top: 0,
        left: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        zIndex: 50,
        transition: "background var(--transition-base)",
      }}
    >
      {/* Brand */}
      <div
        style={{
          height: "var(--header-height)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "0 20px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div
          className="brand-gradient"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Sparkles size={16} color="#fff" />
        </div>
        <div>
          <p
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Creative Audit
          </p>
          <p
            style={{
              fontSize: "10px",
              color: "var(--color-text-muted)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Ad Intelligence
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          overflowY: "auto",
        }}
      >
        <p
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "var(--color-text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "4px 8px 8px",
          }}
        >
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              id={`sidebar-link-${label.toLowerCase()}`}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                background: isActive
                  ? "rgba(79, 179, 186, 0.12)"
                  : "transparent",
                border: isActive
                  ? "1px solid rgba(79, 179, 186, 0.22)"
                  : "1px solid transparent",
                transition: "all var(--transition-fast)",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "var(--color-surface-2)";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--color-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--color-text-secondary)";
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {isActive && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <div
          className="glass"
          style={{
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              className="pulse-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--color-success)",
                flexShrink: 0,
              }}
            />
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              Sync Active
            </p>
          </div>
          <p
            style={{
              fontSize: "10px",
              color: "var(--color-text-muted)",
              lineHeight: 1.4,
            }}
          >
            Last sync: 2 min ago
          </p>
        </div>
      </div>
    </aside>
  );
}
