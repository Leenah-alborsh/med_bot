export const usageLabels: Record<string, string> = {
  START: 'بدء البوت',
  MENU: 'فتح القائمة',
  HOME: 'الرئيسية',
  BACK: 'رجوع',
  INTERACTION: 'تفاعل مع القائمة',
  REPORT: 'الإبلاغ عن ملف',
  VIEW: 'عرض نص',
  OPEN_LINK: 'طلب رابط',
  DOWNLOAD_REQUEST: 'طلب ملف',
};

export function activityDate(value: string) {
  return new Intl.DateTimeFormat('ar-PS-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Hebron',
  }).format(new Date(value));
}

export type UserIdentity = {
  id: string;
  telegramUserId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export const userName = (user: UserIdentity) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.telegramUserId;

export type UsageFilters = { search?: string; from?: string; to?: string; page?: string };

export function usageQuery(filters: UsageFilters, page = filters.page ?? '1') {
  return new URLSearchParams({
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    page,
  });
}
