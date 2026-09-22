import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarRange,
  ClipboardList,
  FileWarning,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { getCurrentAdmin, hasPermission } from '../../src/lib/server-api';
import { LogoutButton } from '../../src/components/logout-button';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  const nav = [
    {
      href: '/dashboard',
      label: '\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629',
      icon: LayoutDashboard,
      show: true,
    },
    {
      href: '/years',
      label:
        '\u0627\u0644\u0633\u0646\u0648\u0627\u062a \u0627\u0644\u062f\u0631\u0627\u0633\u064a\u0629',
      icon: GraduationCap,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/semesters',
      label: '\u0627\u0644\u0641\u0635\u0648\u0644',
      icon: CalendarRange,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/courses',
      label: '\u0627\u0644\u0645\u0648\u0627\u062f',
      icon: BookOpen,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/sections',
      label: '\u0627\u0644\u0623\u0642\u0633\u0627\u0645',
      icon: Boxes,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/content',
      label:
        '\u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0648\u0627\u0644\u0645\u0644\u0641\u0627\u062a',
      icon: ClipboardList,
      show: hasPermission(admin, 'content.read'),
    },
    {
      href: '/admins',
      label: '\u0627\u0644\u0623\u062f\u0645\u0646\u0632',
      icon: ShieldCheck,
      show: hasPermission(admin, 'admins.read'),
    },
    {
      href: '/reports',
      label: '\u0628\u0644\u0627\u063a\u0627\u062a \u0627\u0644\u0645\u0644\u0641\u0627\u062a',
      icon: FileWarning,
      show: hasPermission(admin, 'broken-file-reports.read'),
    },
    {
      href: '/usage',
      label:
        '\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645',
      icon: BarChart3,
      show: hasPermission(admin, 'content.usage-analytics.read'),
    },
    {
      href: '/audit',
      label: '\u0633\u062c\u0644 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a',
      icon: ScrollText,
      show: hasPermission(admin, 'audit.read'),
    },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">
            <Stethoscope size={22} />
          </span>
          <span>\u0645\u0646\u0635\u0629 \u0627\u0644\u0637\u0628</span>
        </Link>
        <nav aria-label="\u0627\u0644\u062a\u0646\u0642\u0644 \u0627\u0644\u0631\u0626\u064a\u0633\u064a">
          {nav
            .filter((item) => item.show)
            .map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
        </nav>
        <div className="account">
          <span className="avatar">{admin.displayNameAr.slice(0, 1)}</span>
          <div>
            <strong>{admin.displayNameAr}</strong>
            <small>{admin.email}</small>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="content-shell">
        <header className="mobile-header">
          <Link className="brand" href="/dashboard">
            <Stethoscope size={21} />
            <span>\u0645\u0646\u0635\u0629 \u0627\u0644\u0637\u0628</span>
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
