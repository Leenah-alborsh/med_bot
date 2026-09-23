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
  Menu,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Tags,
} from 'lucide-react';
import { getCurrentAdmin, hasPermission } from '../../src/lib/server-api';
import { LogoutButton } from '../../src/components/logout-button';
import { ActionHistoryControls } from '../../src/components/action-history-controls';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  const nav = [
    {
      href: '/dashboard',
      label: 'الرئيسية',
      icon: LayoutDashboard,
      show: true,
    },
    {
      href: '/years',
      label: 'السنوات الدراسية',
      icon: GraduationCap,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/semesters',
      label: 'الفصول',
      icon: CalendarRange,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/courses',
      label: 'المواد',
      icon: BookOpen,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/sections',
      label: 'الأقسام',
      icon: Boxes,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/content-types',
      label: 'أنواع المحتوى',
      icon: Tags,
      show: hasPermission(admin, 'catalog.read'),
    },
    {
      href: '/content',
      label: 'المحتوى والملفات',
      icon: ClipboardList,
      show: hasPermission(admin, 'content.read'),
    },
    {
      href: '/admins',
      label: 'المشرفون',
      icon: ShieldCheck,
      show: hasPermission(admin, 'admins.read'),
    },
    {
      href: '/reports',
      label: 'بلاغات الملفات',
      icon: FileWarning,
      show: hasPermission(admin, 'broken-file-reports.read'),
    },
    {
      href: '/usage',
      label: 'تحليل الاستخدام',
      icon: BarChart3,
      show: hasPermission(admin, 'content.usage-analytics.read'),
    },
    {
      href: '/audit',
      label: 'سجل العمليات',
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
          <span>Medical Students Hub</span>
        </Link>
        <nav aria-label="التنقل الرئيسي">
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
            <span>Medical Students Hub</span>
          </Link>
          <details className="mobile-nav">
            <summary aria-label="فتح القائمة">
              <Menu size={22} />
              <span>القائمة</span>
            </summary>
            <nav aria-label="التنقل على الهاتف">
              {nav
                .filter((item) => item.show)
                .map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                ))}
              <LogoutButton />
            </nav>
          </details>
        </header>
        <ActionHistoryControls />
        {children}
      </div>
    </div>
  );
}
