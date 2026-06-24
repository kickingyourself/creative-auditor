"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Film,
  Layers,
  Settings,
  ChevronRight,
  UploadCloud,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  BarChart2,
} from "lucide-react";
import { useSidebar } from "@/context/SidebarContext";

const NAV_ITEMS = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/brands",      label: "Brands",       icon: Building2 },
  { href: "/creatives",   label: "Creatives",    icon: Film },
  { href: "/campaigns",   label: "Campaigns",    icon: Layers },
  { href: "/competitive", label: "Competitive",  icon: BarChart2 },
  { href: "/upload",      label: "Upload",       icon: UploadCloud },
  { href: "/settings",    label: "Settings",     icon: Settings },
];

const COLLAPSED_W  = 64;
const EXPANDED_W   = 240;

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();

  // ── Shared inner content (used in both desktop & mobile) ──────────────────

  const navContent = (isMobile: boolean) => (
    <>
      {/* Brand / Logo row */}
      <div
        style={{
          height: "var(--header-height)",
          display: "flex",
          alignItems: "center",
          gap: collapsed && !isMobile ? 0 : "10px",
          padding: collapsed && !isMobile ? "0" : "0 20px",
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
          overflow: "hidden",
          transition: "padding 250ms ease",
        }}
      >
        {/* PMG logo — inlined SVG to avoid MIME/CSP issues with external file reference */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 67.63 51.78"
          aria-label="PMG"
          role="img"
          style={{
            height: collapsed && !isMobile ? 20 : 28,
            width: collapsed && !isMobile ? 20 : "auto",
            maxWidth: collapsed && !isMobile ? 20 : 90,
            fill: "#ffffff",
            flexShrink: 0,
            transition: "all 250ms ease",
          }}
        >
          <path d="M64.19,17.6l-14.18-14.18c-4.45-4.45-11.62-4.55-16.21-.33-4.59-4.22-11.75-4.12-16.21.33L3.43,17.6c-4.57,4.57-4.57,12,0,16.57l14.18,14.18c2.21,2.21,5.16,3.43,8.29,3.43,2.96,0,5.75-1.11,7.92-3.1,2.17,2,4.96,3.1,7.92,3.1,3.13,0,6.07-1.22,8.29-3.43l14.18-14.18c2.21-2.21,3.43-5.16,3.43-8.29s-1.22-6.07-3.43-8.28ZM33.81,38.81l-9.59-9.59c-1.84-1.84-1.84-4.83,0-6.67l9.59-9.59,9.59,9.59c.89.89,1.38,2.08,1.38,3.33s-.49,2.44-1.38,3.33l-9.59,9.59ZM25.89,44.78c-1.26,0-2.44-.49-3.34-1.38l-14.18-14.18c-1.84-1.84-1.84-4.83,0-6.67l14.18-14.18c.92-.92,2.13-1.38,3.33-1.38,1.04,0,2.08.37,2.93,1.05l-9.56,9.56c-4.57,4.57-4.57,12,0,16.57l9.56,9.56c-.83.67-1.85,1.05-2.94,1.05ZM59.24,29.22l-14.18,14.18c-.89.89-2.08,1.38-3.33,1.38-1.08,0-2.1-.38-2.94-1.05l9.56-9.56c2.21-2.21,3.43-5.16,3.43-8.29s-1.22-6.07-3.43-8.28l-9.56-9.56c.86-.69,1.89-1.05,2.93-1.05,1.21,0,2.42.46,3.33,1.38l14.18,14.18c.89.89,1.38,2.08,1.38,3.33s-.49,2.44-1.38,3.33Z"/>
        </svg>

        {/* Hide text when collapsed (desktop) */}
        {(!collapsed || isMobile) && (
          <div style={{ overflow: "hidden" }}>
            <p style={{
              fontWeight: 700, fontSize: "14px",
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em", lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}>
              Creative Audit
            </p>
            <p style={{
              fontSize: "10px", color: "var(--color-text-muted)",
              letterSpacing: "0.05em", textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}>
              Ad Intelligence
            </p>
          </div>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={closeMobile}
            aria-label="Close menu"
            style={{
              marginLeft: "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              cursor: "pointer", color: "var(--color-text-secondary)",
            }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{
        flex: 1,
        padding: collapsed && !isMobile ? "16px 8px" : "16px 12px",
        display: "flex", flexDirection: "column", gap: "4px",
        overflowY: "auto",
        transition: "padding 250ms ease",
      }}>
        {!collapsed || isMobile ? (
          <p style={{
            fontSize: "10px", fontWeight: 600,
            color: "var(--color-text-muted)",
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "4px 8px 8px",
          }}>
            Navigation
          </p>
        ) : (
          <div style={{ height: 22 }} /> /* spacer when label hidden */
        )}

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              id={`sidebar-link-${label.toLowerCase()}`}
              href={href}
              onClick={isMobile ? closeMobile : undefined}
              title={collapsed && !isMobile ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: collapsed && !isMobile ? "10px 0" : "10px 12px",
                justifyContent: collapsed && !isMobile ? "center" : "flex-start",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                background: isActive ? "rgba(79,179,186,0.12)" : "transparent",
                border: isActive ? "1px solid rgba(79,179,186,0.22)" : "1px solid transparent",
                transition: "all var(--transition-fast)",
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--color-surface-2)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--color-text-secondary)";
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {(!collapsed || isMobile) && (
                <>
                  <span style={{ flex: 1 }}>{label}</span>
                  {isActive && <ChevronRight size={14} style={{ flexShrink: 0 }} />}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / collapse toggle (desktop only) */}
      {!isMobile && (
        <div style={{ padding: "16px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
          <button
            id="sidebar-collapse-toggle"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
            style={{
              width: "100%",
              display: "flex", alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: "8px",
              padding: collapsed ? "8px 0" : "8px 10px",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: "12px", fontWeight: 500,
              cursor: "pointer",
              transition: "all var(--transition-fast)",
              whiteSpace: "nowrap", overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
            }}
          >
            {collapsed
              ? <PanelLeftOpen size={15} style={{ flexShrink: 0 }} />
              : <><PanelLeftClose size={15} style={{ flexShrink: 0 }} /> Collapse</>}
          </button>
        </div>
      )}
    </>
  );

  // ── Desktop sidebar ───────────────────────────────────────────────────────

  return (
    <>
      <aside
        id="sidebar-nav"
        aria-label="Main navigation"
        style={{
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          height: "100vh",
          position: "fixed",
          top: 0, left: 0,
          display: "flex", flexDirection: "column",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          zIndex: 50,
          transition: "width 250ms cubic-bezier(0.4,0,0.2,1)",
          overflow: "hidden",
          // Hidden on mobile — drawer takes over
        }}
        // Hide on mobile via inline style using a media query trick
        className="sidebar-desktop"
      >
        {navContent(false)}
      </aside>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}

      {/* Backdrop */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={closeMobile}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            animation: "fadeIn 200ms ease both",
          }}
        />
      )}

      {/* Drawer panel */}
      <aside
        id="sidebar-mobile"
        aria-label="Mobile navigation"
        style={{
          width: EXPANDED_W,
          height: "100vh",
          position: "fixed",
          top: 0, left: 0,
          display: "flex", flexDirection: "column",
          background: "var(--color-surface)",
          borderRight: "1px solid var(--color-border)",
          zIndex: 70,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
          overflow: "hidden",
        }}
        className="sidebar-mobile"
      >
        {navContent(true)}
      </aside>

      <style>{`
        /* Desktop sidebar visible, mobile hidden */
        .sidebar-desktop { display: flex; }
        .sidebar-mobile  { display: none; }

        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile  { display: flex !important; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
}
