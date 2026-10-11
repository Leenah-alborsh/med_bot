import { redirect } from 'next/navigation';
import { BotManagement } from '../../../src/components/bot-management';
import {
  getCurrentAdmin,
  hasPermission,
  serverApi,
  ServerApiError,
} from '../../../src/lib/server-api';

type Data = {
  welcomeMessage: string;
  hasWelcomePhoto: boolean;
  years: Array<{ id: string; nameAr: string }>;
  recent: Array<{
    id: string;
    message: string;
    targetYearIds: string[];
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
  }>;
};
export default async function BotManagementPage() {
  const admin = await getCurrentAdmin();
  if (!hasPermission(admin, 'bots.read')) redirect('/dashboard');
  let initial: Data;
  try {
    initial = await serverApi<Data>('announcements');
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      !hasPermission(admin, 'announcements.send')
    ) {
      return (
        <main className="page">
          <h1>البوت والإعلانات</h1>
          <p className="notice" role="status">
            إعدادات البوت غير متاحة حالياً لهذا الحساب.
          </p>
        </main>
      );
    }
    throw error;
  }
  return (
    <BotManagement
      initial={initial}
      canManageBot={hasPermission(admin, 'bots.manage')}
      canSendAnnouncements={hasPermission(admin, 'announcements.send')}
    />
  );
}
