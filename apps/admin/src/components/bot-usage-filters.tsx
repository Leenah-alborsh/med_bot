import Link from 'next/link';
import { usageQuery, type UsageFilters } from '../lib/bot-users';
import styles from './bot-usage.module.css';

export function BotUsageFilters({
  filters,
  search = false,
}: {
  filters: UsageFilters;
  search?: boolean;
}) {
  return (
    <form className={`${styles.filters} ${search ? styles.withSearch : ''}`} method="get">
      {search && (
        <label className={styles.searchField}>
          بحث بالاسم أو المعرّف
          <input
            name="search"
            defaultValue={filters.search}
            maxLength={100}
            placeholder="الاسم، اسم المستخدم أو المعرّف"
          />
        </label>
      )}
      <label>
        من تاريخ (UTC)
        <input type="date" name="from" dir="ltr" defaultValue={filters.from} />
      </label>
      <label>
        إلى تاريخ (UTC)
        <input type="date" name="to" dir="ltr" defaultValue={filters.to} />
      </label>
      <div className={styles.filterActions}>
        <button type="submit">تطبيق</button>
        <Link href="?">مسح الفلاتر</Link>
      </div>
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
    <nav className={styles.pagination} aria-label="صفحات النتائج">
      <span>
        {total} نتيجة · الصفحة {page} من {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      {page > 1 && (
        <Link className={styles.activityLink} href={`?${usageQuery(filters, String(page - 1))}`}>
          السابق
        </Link>
      )}
      {page * pageSize < total && (
        <Link className={styles.activityLink} href={`?${usageQuery(filters, String(page + 1))}`}>
          التالي
        </Link>
      )}
    </nav>
  );
}
