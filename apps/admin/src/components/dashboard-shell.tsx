'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
import { ActionHistoryControls } from './action-history-controls';
import { HubBrand } from './hub-brand';

export function DashboardShell({
  navigation,
  account,
  routes,
  children,
}: {
  navigation: ReactNode;
  account: ReactNode;
  routes: Array<{ href: string; label: string }>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const title =
    routes.find((route) => pathname === route.href || pathname?.startsWith(`${route.href}/`))
      ?.label ?? 'لوحة الإدارة';

  useEffect(() => {
    drawer.current?.close();
  }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 981px)');
    const close = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);

  return (
    <div className={`app-shell dashboard-shell${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="sidebar">
        <HubBrand />
        <nav aria-label="التنقل الرئيسي">{navigation}</nav>
        {account}
      </aside>
      <div className="content-shell">
        <header className="workspace-topbar">
          <button
            className="icon-button desktop-menu-toggle"
            type="button"
            aria-label={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            title={collapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
          </button>
          <button
            className="icon-button mobile-menu-toggle"
            type="button"
            aria-label="فتح القائمة"
            title="فتح القائمة"
            aria-haspopup="dialog"
            onClick={() => drawer.current?.showModal()}
          >
            <Menu size={21} />
          </button>
          <div className="workspace-location">
            <span>لوحة الإدارة</span>
            <strong>{title}</strong>
          </div>
          <ActionHistoryControls />
        </header>
        {children}
      </div>
      <dialog
        ref={drawer}
        className="navigation-drawer"
        aria-label="التنقل الرئيسي"
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
      >
        <div className="drawer-heading">
          <HubBrand />
          <button
            className="icon-button"
            type="button"
            aria-label="إغلاق القائمة"
            title="إغلاق القائمة"
            onClick={() => drawer.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <nav
          aria-label="التنقل على الهاتف"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) drawer.current?.close();
          }}
        >
          {navigation}
        </nav>
        {account}
      </dialog>
    </div>
  );
}
