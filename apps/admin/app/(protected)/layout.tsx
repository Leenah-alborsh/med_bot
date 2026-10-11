import {
  BarChart3,
  BookOpen,
  Boxes,
  CalendarRange,
  ClipboardList,
  FileWarning,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Tags,
  UploadCloud,
} from 'lucide-react';
import { getCurrentAdmin, hasPermission } from '../../src/lib/server-api';
import { LogoutButton } from '../../src/components/logout-button';
import { ActiveNavLink } from '../../src/components/active-nav-link';
import { DashboardShell } from '../../src/components/dashboard-shell';

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
      href: '/telegram-inbox',
      label: 'الملفات الواردة',
      icon: Inbox,
      show: hasPermission(admin, 'content.read') && hasPermission(admin, 'content.create'),
    },
    {
      href: '/uploads',
      label: 'رفع الملفات',
      icon: UploadCloud,
      show: hasPermission(admin, 'content.update'),
    },
    {
      href: '/admins',
      label: 'المشرفون',
      icon: ShieldCheck,
      show: hasPermission(admin, 'admins.read'),
    },
    {
      href: '/bot-management',
      label: 'البوت والإعلانات',
      icon: Megaphone,
      show: hasPermission(admin, 'announcements.send'),
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
  const groups = [
    { label: 'نظرة عامة', paths: ['/dashboard', '/usage'] },
    {
      label: 'المكتبة التعليمية',
      paths: [
        '/years',
        '/semesters',
        '/courses',
        '/content-types',
        '/sections',
        '/content',
        '/telegram-inbox',
        '/uploads',
      ],
    },
    { label: 'الإدارة والمتابعة', paths: ['/bot-management', '/reports', '/admins', '/audit'] },
  ];
  const visibleNav = nav.filter((item) => item.show);
  const navigation = groups.map((group) => {
    const items = visibleNav.filter((item) => group.paths.includes(item.href));
    return (
      items.length > 0 && (
        <div className="nav-group" key={group.label}>
          <p className="nav-group-label">{group.label}</p>
          {items.map(({ href, label, icon: Icon }) => (
            <ActiveNavLink key={href} href={href} title={label}>
              <Icon size={19} />
              <span>{label}</span>
            </ActiveNavLink>
          ))}
        </div>
      )
    );
  });
  return (
    <DashboardShell
      routes={visibleNav.map(({ href, label }) => ({ href, label }))}
      navigation={navigation}
      account={
        <div className="account">
          <span className="avatar">{admin.displayNameAr.slice(0, 1)}</span>
          <div>
            <strong>{admin.displayNameAr}</strong>
            <small>{admin.email}</small>
          </div>
          <LogoutButton />
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
