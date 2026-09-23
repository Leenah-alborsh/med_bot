import { redirect } from 'next/navigation';
import { BotManagement } from '../../../src/components/bot-management';
import { getCurrentAdmin, hasPermission, serverApi } from '../../../src/lib/server-api';

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
  if (!hasPermission(admin, 'announcements.send')) redirect('/dashboard');
  return <BotManagement initial={await serverApi<Data>('announcements')} />;
}
