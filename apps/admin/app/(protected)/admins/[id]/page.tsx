import { redirect } from 'next/navigation';
import { AdminDetailForm } from '../../../../src/components/admin-detail-form';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../../src/lib/server-api';

interface AdminDetail {
  id: string;
  email: string;
  displayNameAr: string;
  displayNameEn: string;
  status: string;
  roles: Array<{ id: string }>;
  scopes: Array<{ botId?: string; academicYearId?: string; courseId?: string }>;
}
interface Role {
  id: string;
  nameAr: string;
}
interface ScopeOption {
  id: string;
  nameAr: string;
}

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAdmin();
  if (!hasPermission(current, 'admins.read')) redirect('/dashboard');
  const { id } = await params;
  const canReadCatalog = hasPermission(current, 'catalog.read');
  const [admin, roles, years, courses] = await Promise.all([
    serverApi<AdminDetail>(`admins/${id}`),
    serverApi<Role[]>('admins/roles'),
    canReadCatalog
      ? serverApi<{ items: ScopeOption[] }>('catalog/years?pageSize=100')
      : Promise.resolve({ items: [] }),
    canReadCatalog
      ? serverApi<{ items: ScopeOption[] }>('catalog/courses?pageSize=100')
      : Promise.resolve({ items: [] }),
  ]);
  return (
    <main className="page">
      <p className="eyebrow">إدارة المشرف</p>
      <h1>{admin.displayNameAr}</h1>
      <AdminDetailForm
        admin={admin}
        roles={roles}
        years={years.items}
        courses={courses.items}
        currentAdminId={current.id}
      />
    </main>
  );
}
