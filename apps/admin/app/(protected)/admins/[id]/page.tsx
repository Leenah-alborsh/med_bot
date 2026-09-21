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

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const current = await getCurrentAdmin();
  if (!hasPermission(current, 'admins.read')) redirect('/dashboard');
  const { id } = await params;
  const [admin, roles] = await Promise.all([
    serverApi<AdminDetail>(`admins/${id}`),
    serverApi<Role[]>('admins/roles'),
  ]);
  return (
    <main className="page">
      <p className="eyebrow">إدارة المشرف</p>
      <h1>{admin.displayNameAr}</h1>
      <AdminDetailForm admin={admin} roles={roles} currentAdminId={current.id} />
    </main>
  );
}
