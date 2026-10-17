import Link from 'next/link';
import { usageQuery, type UsageFilters } from '../lib/bot-users';

export function BotUsageFilters({
  filters,
  search = false,
}: {
  filters: UsageFilters;
  search?: boolean;
}) {
  return (
    <form className="flow-filters" method="get">
      {search && (
        <label>
          بحث بالاسم أو المعرّف
          <input
            name="search"
            defaultValue={filters.search}
            maxLength={100}
            placeholder="اسم المستخدم أو Telegram ID"
          />
        </label>
      )}
      <label>
        من تاريخ (UTC)
        <input type="date" name="from" defaultValue={filters.from} />
      </label>
      <label>
        إلى تاريخ (UTC)
        <input type="date" name="to" defaultValue={filters.to} />
      </label>
      <button type="submit">تطبيق</button>
      <Link className="secondary-link" href="?">
        مسح الفلاتر
      </Link>
    </form>
  );
}

export function UsagePagination({
  total,
  page,
  pageSize,
  filters,
}: {
  total: number;
  page: number;
  pageSize: number;
  filters: UsageFilters;
}) {
  return (
    <nav className="pagination" aria-label="صفحات النتائج">
      <span>
        {total} نتيجة · الصفحة {page} من {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      {page > 1 && <Link href={`?${usageQuery(filters, String(page - 1))}`}>السابق</Link>}
      {page * pageSize < total && (
        <Link href={`?${usageQuery(filters, String(page + 1))}`}>التالي</Link>
      )}
    </nav>
  );
}
