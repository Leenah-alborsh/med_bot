import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminCreateForm } from '../../../src/components/admin-create-form';
import { AdminDeleteButton } from '../../../src/components/admin-delete-button';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';

const statusLabels: Record<string, string> = {
  ACTIVE: 'نشط',
  PENDING: 'بانتظار إعداد كلمة المرور',
  DISABLED: 'معطّل',
};
interface AdminRow {
  id: string;
  email: string;
  displayNameAr: string;
  status: string;
  mustChangePassword: boolean;
  roles: Array<{ id: string; key: string; nameAr: string }>;
}
interface Role {
  id: string;
  nameAr: string;
  nameEn: string;
}

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, 'admins.read')) redirect('/dashboard');
  const { search = '' } = await searchParams;
  const query = new URLSearchParams({ page: '1', pageSize: '50', ...(search ? { search } : {}) });
  const [result, roles] = await Promise.all([
    serverApi<{ items: AdminRow[]; total: number }>(`admins?${query}`),
    serverApi<Role[]>('admins/roles'),
  ]);
  const isSuperAdmin = admin.roleKeys.includes('super-admin');
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">إدارة الوصول</p>
          <h1>المشرفون</h1>
          <p className="muted">إضافة المشرفين، دعوتهم، وتحديد صلاحيات كل حساب.</p>
        </div>
      </header>
      <form className="search" method="get">
        <label className="sr-only" htmlFor="search">
          بحث
        </label>
        <input
          id="search"
          name="search"
          defaultValue={search}
          placeholder="البحث بالاسم أو البريد"
        />
        <button type="submit">بحث</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>المشرف</th>
              <th>حالة الدخول</th>
              <th>الأدوار</th>
              <th>
                <span className="sr-only">إدارة</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.displayNameAr}</strong>
                  <span className="table-subtitle">{item.email}</span>
                </td>
                <td>
                  <span
                    className="badge"
                    data-state={
                      item.status === 'ACTIVE'
                        ? 'active'
                        : item.status === 'PENDING'
                          ? 'draft'
                          : 'inactive'
                    }
                  >
                    {statusLabels[item.status] ?? item.status}
                  </span>
                </td>
                <td>{item.roles.map((role) => role.nameAr).join('، ') || 'بدون دور'}</td>
                <td>
                  <div className="row-actions">
                    <Link className="secondary-link" href={`/admins/${item.id}`}>
                      إدارة الحساب
                    </Link>
                    {isSuperAdmin &&
                      item.id !== admin.id &&
                      !item.roles.some((role) => role.key === 'super-admin') && (
                        <AdminDeleteButton id={item.id} name={item.displayNameAr} />
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{result.total} حساب</p>
      {hasPermission(admin, 'admins.create') && <AdminCreateForm roles={roles} />}
    </main>
  );
}
