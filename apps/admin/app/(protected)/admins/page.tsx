import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';
import { AdminCreateForm } from '../../../src/components/admin-create-form';

const statusLabels: Record<string, string> = {
  ACTIVE: 'نشط',
  PENDING: 'بانتظار التفعيل',
  DISABLED: 'معطل',
};
interface AdminRow {
  id: string;
  email: string;
  displayNameAr: string;
  status: string;
  roles: Array<{ id: string; nameAr: string }>;
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
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">إدارة الوصول</p>
          <h1>المشرفون</h1>
        </div>
      </div>
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
              <th>الحالة</th>
              <th>الأدوار</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.displayNameAr}</strong>
                  <span className="table-subtitle">{item.email}</span>
                </td>
                <td>{statusLabels[item.status] ?? item.status}</td>
                <td>{item.roles.map((role) => role.nameAr).join('، ') || 'بدون دور'}</td>
                <td>
                  <Link className="link" href={`/admins/${item.id}`}>
                    إدارة
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{result.total} حساباً</p>
      {hasPermission(admin, 'admins.create') && <AdminCreateForm roles={roles} />}
    </main>
  );
}
