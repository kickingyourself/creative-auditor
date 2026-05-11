"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Search, Bell, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useSidebar } from "@/context/SidebarContext";

export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { toggleMobile } = useSidebar();

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header
      id="top-header"
      style={{
        height: "var(--header-height)",
        position: "fixed",
        top: 0,
        left: "var(--sidebar-width)",
        right: 0,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        backdropFilter: "blur(12px)",
        transition: "background var(--transition-base)",
      }}
    >
      {/* Mobile hamburger — hidden on desktop via CSS */}
      <button
        id="header-menu-toggle"
        aria-label="Open navigation"
        onClick={toggleMobile}
        className="mobile-menu-btn"
        style={{
          display: "none",
          alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: "8px",
          border: "1px solid var(--color-border)",
          background: "transparent",
          color: "var(--color-text-secondary)",
          cursor: "pointer",
          flexShrink: 0,
          marginRight: "4px",
        }}
      >
        <Menu size={18} />
      </button>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flex: 1,
          maxWidth: 420,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            padding: "8px 14px",
            width: "100%",
            transition: "border-color var(--transition-fast)",
            cursor: "text",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-accent)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor =
              "var(--color-border)";
          }}
        >
          <Search size={15} color="var(--color-text-muted)" />
          <input
            id="header-search"
            type="text"
            placeholder="Search brands, creatives…"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--color-text-primary)",
              fontSize: "13px",
              width: "100%",
            }}
          />
          <kbd
            style={{
              fontSize: "10px",
              color: "var(--color-text-muted)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "2px 6px",
              fontFamily: "monospace",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Notification */}
        <button
          id="header-notifications"
          aria-label="Notifications"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            cursor: "pointer",
            transition: "all var(--transition-fast)",
            position: "relative",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--color-surface-2)";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
            (e.currentTarget as HTMLButtonElement).style.color =
              "var(--color-text-secondary)";
          }}
        >
          <Bell size={16} />
          <span
            style={{
              position: "absolute",
              top: 7,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-accent)",
            }}
          />
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            id="header-theme-toggle"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
              transition: "all var(--transition-fast)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "var(--color-surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--color-text-secondary)";
            }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {/* Avatar */}
        <div
          id="header-avatar"
          className="brand-gradient"
          style={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          S
        </div>
      </div>
    </header>
  );
}
