"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

interface SidebarContextValue {
  collapsed: boolean;    // desktop icon-only mode
  mobileOpen: boolean;   // mobile full-drawer mode
  toggleCollapsed: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: true,
  mobileOpen: false,
  toggleCollapsed: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync collapsed → CSS custom property on <html> so <main> and <header> reflow via CSS
  useEffect(() => {
    const root = document.documentElement;
    if (collapsed) {
      root.setAttribute("data-sidebar-collapsed", "true");
    } else {
      root.removeAttribute("data-sidebar-collapsed");
    }
  }, [collapsed]);

  // Close mobile drawer on route change / ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
  const toggleMobile    = useCallback(() => setMobileOpen((o) => !o), []);
  const closeMobile     = useCallback(() => setMobileOpen(false), []);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, toggleCollapsed, toggleMobile, closeMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
