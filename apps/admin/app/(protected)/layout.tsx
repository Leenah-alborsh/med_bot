import Link from 'next/link';
import { getCurrentAdmin, hasPermission } from '../../src/lib/server-api';
import { LogoutButton } from '../../src/components/logout-button';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          إدارة منصة الطب
        </Link>
        <nav aria-label="التنقل الرئيسي">
          <Link href="/dashboard">لوحة المعلومات</Link>
          {hasPermission(admin, 'admins.read') && <Link href="/admins">المشرفون</Link>}
        </nav>
        <div className="account">
          <strong>{admin.displayNameAr}</strong>
          <span>{admin.email}</span>
          <LogoutButton />
        </div>
      </aside>
      <div className="content-shell">
        <header className="mobile-header">
          <Link className="brand" href="/dashboard">
            إدارة منصة الطب
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
