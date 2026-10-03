'use client';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { clientApi, clientUpload } from '../lib/client-api';
import {
  DIRECT_UPLOAD_TOO_LARGE_MESSAGE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MEGABYTES,
} from '../lib/upload-limits';

type Item = {
  source: 'managed_content';
  unifiedId: string;
  id: string;
  titleAr: string;
  titleEn?: string;
  telegramLinkCode?: string;
  sectionId: string;
  bodyText?: string;
  contentCategoryId: string;
  contentCategory: { nameAr: string };
  contentType: 'TEXT' | 'LINK' | 'FILE';
  state: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  displayOrder: number;
  section: {
    nameAr: string;
    course: { id: string; nameAr: string; semester: { id: string; academicYearId: string } };
  };
  attachments: Array<{
    id: string;
    storageProvider: 'TELEGRAM' | 'EXTERNAL_URL';
    originalFilename: string;
    externalUrl?: string;
  }>;
};
type InboxItem = {
  source: 'telegram_inbox';
  unifiedId: string;
  id: string;
  titleAr: string;
  fileName: string;
  mimeType: string;
  fileSize: string;
  needsClassification: true;
};
export type UnifiedContentItem = Item | InboxItem;
export type ContentFilters = Partial<
  Record<
    | 'yearId'
    | 'semesterId'
    | 'courseId'
    | 'sectionId'
    | 'contentCategoryId'
    | 'type'
    | 'state'
    | 'search',
    string
  >
>;
type Option = {
  id: string;
  nameAr: string;
  academicYearId?: string;
  semesterId?: string;
  courseId?: string;
  sectionId?: string;
  hasSections?: boolean;
  courseHasSections?: boolean;
  isActive?: boolean;
  archivedAt?: string | null;
};
type Section = Option;
const contentTypeLabels = { TEXT: 'نص', LINK: 'رابط', FILE: 'ملف' } as const;
const stateLabels = { DRAFT: 'مسودة', PUBLISHED: 'منشور', ARCHIVED: 'مؤرشف' } as const;
type ContentType = 'TEXT' | 'LINK' | 'FILE';

function formText(data: FormData, name: string) {
  const value = data.get(name);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function formContentType(data: FormData): ContentType {
  const value = formText(data, 'contentType');
  return value === 'LINK' || value === 'FILE' ? value : 'TEXT';
}
export function ContentManager({
  items,
  categories,
  sections,
  courses,
  semesters,
  years,
  total,
  page,
  pageSize,
  filters,
  inboxAvailable,
}: {
  items: UnifiedContentItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: ContentFilters;
  inboxAvailable: boolean;
  categories: Option[];
  sections: Section[];
  courses: Option[];
  semesters: Option[];
  years: Option[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const [createCourseId, setCreateCourseId] = useState('');
  const [createSectionId, setCreateSectionId] = useState('');
  const [editingCourseId, setEditingCourseId] = useState('');
  const [editingSectionId, setEditingSectionId] = useState('');
  const [createContentType, setCreateContentType] = useState<ContentType>('TEXT');
  const [creating, setCreating] = useState(false);
  const filterYearId = filters.yearId ?? '';
  const filterSemesterId = filters.semesterId ?? '';
  const filterCourseId = filters.courseId ?? '';
  const filterCategoryId = filters.contentCategoryId ?? '';
  function contentUrl(nextPage: number, updates: ContentFilters = {}) {
    const query = new URLSearchParams({ page: String(nextPage) });
    for (const [key, value] of Object.entries({ ...filters, ...updates })) {
      if (value) query.set(key, value);
    }
    return `/content?${query}`;
  }
  function changeFilters(updates: ContentFilters) {
    setEditing(null);
    router.push(contentUrl(1, updates));
  }
  const visibleSemesters = semesters.filter(
    (semester) => !filterYearId || semester.academicYearId === filterYearId,
  );
  const visibleCourses = courses.filter(
    (course) =>
      (!filterYearId || course.academicYearId === filterYearId) &&
      (!filterSemesterId || course.semesterId === filterSemesterId),
  );
  const createCourse = courses.find((course) => course.id === createCourseId);
  const availableCreateCourses = courses.filter(
    (course) => course.isActive !== false && !course.archivedAt,
  );
  const createCourseSections = sections.filter(
    (section) =>
      section.courseId === createCourseId && section.isActive !== false && !section.archivedAt,
  );
  const effectiveCreateSectionId =
    createCourse?.hasSections === false ? (createCourseSections[0]?.id ?? '') : createSectionId;
  const editingCourse = courses.find((course) => course.id === editingCourseId);
  const editingCourseSections = sections.filter((section) => section.courseId === editingCourseId);
  const effectiveEditingSectionId =
    editingCourse?.hasSections === false
      ? editing?.section.course.id === editingCourseId
        ? editing.sectionId
        : (editingCourseSections[0]?.id ?? '')
      : editingSectionId;
  const createCategories = categories.filter(
    (category) =>
      category.sectionId === effectiveCreateSectionId &&
      category.isActive !== false &&
      !category.archivedAt,
  );
  const editCategories = categories.filter(
    (category) => category.sectionId === effectiveEditingSectionId,
  );
  const visibleCategories = categories.filter((category) => {
    const section = sections.find((item) => item.id === category.sectionId);
    return (
      (!filterCourseId || section?.courseId === filterCourseId) &&
      (!filters.sectionId || category.sectionId === filters.sectionId)
    );
  });
  const filteredItems = items.filter((item): item is Item => item.source === 'managed_content');
  const inboxItems = items.filter((item): item is InboxItem => item.source === 'telegram_inbox');
  async function uploadFiles(id: string, files: File[], progressKey: string) {
    const oversized = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversized) {
      throw new Error(DIRECT_UPLOAD_TOO_LARGE_MESSAGE);
    }
    for (const [index, file] of files.entries()) {
      const payload = new FormData();
      payload.append('originalFilename', file.name);
      payload.append('file', file);
      setUploadProgress((current) => ({
        ...current,
        [progressKey]: Math.round((index / files.length) * 100),
      }));
      const { ticket } = await clientApi<{ ticket: string }>(`content/${id}/upload-ticket`, {
        method: 'POST',
      });
      await clientUpload(
        `content-upload/${id}`,
        payload,
        (value) =>
          setUploadProgress((current) => ({
            ...current,
            [progressKey]: Math.round(((index + value / 100) / files.length) * 100),
          })),
        ticket,
      );
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data
      .getAll('files')
      .filter((value): value is File => value instanceof File && value.size > 0);
    let createdItemId: string | null = null;
    setCreating(true);
    try {
      const contentType = formContentType(data);
      const bodyText = formText(data, 'bodyText');
      if (contentType === 'TEXT' && !bodyText) {
        setMessage('النص مطلوب عند اختيار محتوى نصي.');
        return;
      }
      const item = await clientApi<{ id: string }>('content', {
        method: 'POST',
        body: JSON.stringify({
          sectionId: formText(data, 'sectionId'),
          courseId: createCourse?.hasSections === false ? createCourseId : undefined,
          titleAr: formText(data, 'titleAr'),
          titleEn: formText(data, 'titleEn'),
          contentCategoryId: formText(data, 'contentCategoryId'),
          contentType,
          bodyText,
          displayOrder: Number(formText(data, 'displayOrder') ?? 0),
        }),
      });
      createdItemId = item.id;
      const externalUrl = data.get('externalUrl');
      const url = typeof externalUrl === 'string' ? externalUrl.trim() : '';
      if (url)
        await clientApi(`content/${item.id}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            storageProvider: 'EXTERNAL_URL',
            originalFilename: 'external-link',
            externalUrl: url,
            mimeType: 'text/uri-list',
            fileSize: 0,
          }),
        });
      if (files.length) await uploadFiles(item.id, files, 'create');
      form.reset();
      setCreateCourseId('');
      setCreateSectionId('');
      setCreateContentType('TEXT');
      setMessage(
        files.length > 1
          ? `تم إنشاء المحتوى ورفع ${files.length} ملفات إلى Telegram.`
          : files.length === 1
            ? 'تم إنشاء المحتوى ورفع الملف إلى Telegram.'
            : 'تم إنشاء المحتوى كمسودة.',
      );
      router.refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'حدث خطأ غير متوقع.';
      setMessage(
        createdItemId
          ? `تم إنشاء المسودة، لكن تعذر إكمال رفع جميع الملفات: ${detail}`
          : `تعذر إنشاء المحتوى: ${detail}`,
      );
    } finally {
      setCreating(false);
      setUploadProgress((current) => {
        const next = { ...current };
        delete next.create;
        return next;
      });
    }
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    try {
      const contentType = formContentType(data);
      const bodyText = formText(data, 'bodyText');
      if (contentType === 'TEXT' && !bodyText) {
        setMessage('النص مطلوب عند اختيار محتوى نصي.');
        return;
      }
      await clientApi(`content/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sectionId:
            formText(data, 'sectionId') === editing.sectionId
              ? undefined
              : formText(data, 'sectionId'),
          titleAr: formText(data, 'titleAr'),
          titleEn: formText(data, 'titleEn'),
          contentCategoryId:
            formText(data, 'contentCategoryId') === editing.contentCategoryId
              ? undefined
              : formText(data, 'contentCategoryId'),
          contentType,
          bodyText,
          displayOrder: Number(formText(data, 'displayOrder') ?? 0),
        }),
      });
      setEditing(null);
      setEditingCourseId('');
      setEditingSectionId('');
      setMessage('تم حفظ تعديلات المحتوى.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تعديل المحتوى.');
    }
  }
  async function remove(id: string) {
    if (!confirm('سيُحذف المحتوى وملفاته نهائيًا. هل أنت متأكد؟')) return;
    try {
      await clientApi(`content/${id}`, { method: 'DELETE' });
      setEditing(null);
      setMessage('تم حذف المحتوى.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حذف المحتوى.');
    }
  }
  async function state(id: string, next: 'PUBLISHED' | 'ARCHIVED') {
    if (next === 'ARCHIVED' && !confirm('هل تريد أرشفة هذا المحتوى؟')) return;
    try {
      await clientApi(`content/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: next }),
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث الحالة.');
    }
  }
  async function restore(id: string) {
    try {
      await clientApi(`content/${id}/state`, {
        method: 'POST',
        body: JSON.stringify({ state: 'DRAFT' }),
      });
      setMessage('تمت استعادة المحتوى كمسودة.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت استعادة المحتوى.');
    }
  }
  async function addLink(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawUrl = data.get('externalUrl');
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    try {
      await clientApi(`content/${id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          storageProvider: 'EXTERNAL_URL',
          originalFilename: 'external-link',
          externalUrl: url,
          mimeType: 'text/uri-list',
          fileSize: 0,
        }),
      });
      form.reset();
      setMessage('تمت إضافة الرابط.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذرت إضافة الرابط.');
    }
  }
  async function copyLinkCode(code: string) {
    await navigator.clipboard.writeText(code);
    setMessage('Telegram link code copied.');
  }
  async function upload(id: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const selected = form.elements.namedItem('file');
    const files = selected instanceof HTMLInputElement ? Array.from(selected.files ?? []) : [];
    if (!files.length) return;
    try {
      await uploadFiles(id, files, id);
      setMessage(
        files.length > 1
          ? `تم رفع ${files.length} ملفات وحفظها في Telegram.`
          : 'تم رفع الملف وحفظه في Telegram.',
      );
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر رفع الملفات.');
    } finally {
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">المكتبة التعليمية</p>
          <h1>المحتوى والملفات</h1>
          <p className="muted">أنشئ المحتوى، أرفق موارده، ثم انشره للطلاب.</p>
        </div>
      </header>
      {!inboxAvailable && (
        <p className="notice" role="status">
          ملفات Telegram الواردة غير متاحة حاليًا.
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="flow-filters content-filters" aria-label="فلاتر المحتوى">
        <label>
          السنة الدراسية
          <select
            value={filterYearId}
            onChange={(event) => {
              changeFilters({
                yearId: event.target.value,
                semesterId: '',
                courseId: '',
                sectionId: '',
                contentCategoryId: '',
              });
            }}
          >
            <option value="">كل السنوات</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          الفصل الدراسي
          <select
            value={filterSemesterId}
            onChange={(event) => {
              changeFilters({
                semesterId: event.target.value,
                courseId: '',
                sectionId: '',
                contentCategoryId: '',
              });
            }}
          >
            <option value="">كل الفصول</option>
            {visibleSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          المادة
          <select
            value={filterCourseId}
            onChange={(event) =>
              changeFilters({ courseId: event.target.value, sectionId: '', contentCategoryId: '' })
            }
          >
            <option value="">كل المواد</option>
            {visibleCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.nameAr}
              </option>
            ))}
          </select>
        </label>
        <label>
          نوع المحتوى
          <select
            value={filterCategoryId}
            onChange={(event) => changeFilters({ contentCategoryId: event.target.value })}
          >
            <option value="">كل الأنواع</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameAr}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="flow-filters content-filters" aria-label="فلاتر إضافية">
        <label>
          القسم
          <select
            value={filters.sectionId ?? ''}
            onChange={(event) =>
              changeFilters({ sectionId: event.target.value, contentCategoryId: '' })
            }
          >
            <option value="">كل الأقسام</option>
            {sections
              .filter((section) => !filterCourseId || section.courseId === filterCourseId)
              .map((section) => (
                <option key={section.id} value={section.id}>
                  {section.nameAr}
                </option>
              ))}
          </select>
        </label>
        <label>
          صيغة المحتوى
          <select
            value={filters.type ?? ''}
            onChange={(event) => changeFilters({ type: event.target.value })}
          >
            <option value="">كل الصيغ</option>
            {Object.entries(contentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          الحالة
          <select
            value={filters.state ?? ''}
            onChange={(event) => changeFilters({ state: event.target.value })}
          >
            <option value="">كل الحالات</option>
            {Object.entries(stateLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="workspace-grid content-workspace">
        <div className="content-list">
          {inboxItems.map((item) => (
            <article className="content-row" key={item.unifiedId}>
              <div>
                <div className="row-title">
                  <strong>{item.titleAr}</strong>
                  <span className="badge">بحاجة إلى تصنيف</span>
                </div>
                <span className="muted">Telegram · {item.mimeType}</span>
              </div>
              <div className="row-actions action-cluster">
                <Link
                  className="icon-button"
                  title="تصنيف الملف"
                  aria-label={`تصنيف ${item.fileName}`}
                  href={`/telegram-inbox?${new URLSearchParams({ search: item.fileName })}`}
                >
                  <FilePlus2 size={17} />
                </Link>
              </div>
            </article>
          ))}
          {filteredItems
            .filter((item) => item.state !== 'ARCHIVED')
            .map((item) => (
              <article className="content-row" key={item.unifiedId}>
                <div>
                  <div className="row-title">
                    <strong>{item.titleAr}</strong>
                    <span className="badge" data-state={item.state.toLowerCase()}>
                      {stateLabels[item.state]}
                    </span>
                  </div>
                  <span className="muted">
                    {item.section.course.nameAr} / {item.section.nameAr} ·{' '}
                    {item.contentCategory.nameAr} · {contentTypeLabels[item.contentType]}
                  </span>
                </div>
                <div className="row-actions action-cluster">
                  <button
                    className="icon-button"
                    title="تعديل"
                    aria-label="تعديل"
                    onClick={() => {
                      setEditing(item);
                      setEditingCourseId(item.section.course.id);
                      setEditingSectionId(item.sectionId);
                    }}
                  >
                    <Pencil size={17} />
                  </button>
                  {item.state !== 'PUBLISHED' && (
                    <button
                      className="icon-button success"
                      title="نشر"
                      onClick={() => void state(item.id, 'PUBLISHED')}
                    >
                      <Send size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button archive"
                    title="أرشفة"
                    aria-label="أرشفة"
                    onClick={() => void state(item.id, 'ARCHIVED')}
                    disabled={item.state === 'ARCHIVED'}
                  >
                    <Archive size={17} />
                  </button>
                  <button
                    className="icon-button danger"
                    title={item.state === 'ARCHIVED' ? 'حذف نهائي' : 'أرشف المحتوى أولًا'}
                    aria-label="حذف نهائي"
                    onClick={() => void remove(item.id)}
                    disabled={item.state !== 'ARCHIVED'}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {editing?.id === item.id && (
                  <form className="inline-editor form" onSubmit={saveEdit}>
                    <div className="section-title">
                      <Pencil size={17} />
                      <h2>تعديل المحتوى</h2>
                      <button
                        className="icon-button dismiss"
                        type="button"
                        title="إلغاء"
                        onClick={() => {
                          setEditing(null);
                          setEditingCourseId('');
                          setEditingSectionId('');
                        }}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <div className="compact-form-grid">
                      <label>
                        المادة
                        <select
                          value={editingCourseId}
                          onChange={(event) => {
                            setEditingCourseId(event.target.value);
                            setEditingSectionId('');
                          }}
                          required
                        >
                          {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                              {course.nameAr}
                            </option>
                          ))}
                        </select>
                      </label>
                      {editingCourse?.hasSections === false ? (
                        <input type="hidden" name="sectionId" value={effectiveEditingSectionId} />
                      ) : (
                        <label>
                          القسم
                          <select
                            name="sectionId"
                            value={editingSectionId}
                            onChange={(event) => setEditingSectionId(event.target.value)}
                            required
                          >
                            <option value="">اختر القسم</option>
                            {editingCourseSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.nameAr}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        نوع المحتوى
                        <select
                          name="contentCategoryId"
                          defaultValue={editing.contentCategoryId}
                          required
                        >
                          {editCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.nameAr}
                            </option>
                          ))}
                        </select>
                      </label>{' '}
                      <label>
                        العنوان بالعربية
                        <input name="titleAr" defaultValue={editing.titleAr} required />
                      </label>
                      <label>
                        العنوان بالإنجليزية
                        <input name="titleEn" defaultValue={editing.titleEn ?? ''} dir="ltr" />
                      </label>
                      <label>
                        صيغة المحتوى
                        <select name="contentType" defaultValue={editing.contentType}>
                          <option value="TEXT">نص</option>
                          <option value="LINK">رابط</option>
                          <option value="FILE">ملف</option>
                        </select>
                      </label>
                      <label>
                        ترتيب العرض
                        <input
                          name="displayOrder"
                          type="number"
                          min="0"
                          defaultValue={editing.displayOrder}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      النص أو الوصف
                      <textarea name="bodyText" rows={4} defaultValue={editing.bodyText ?? ''} />
                    </label>
                    <div className="form-actions">
                      <button className="primary" type="submit">
                        <Save size={17} /> حفظ التعديلات
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setEditingCourseId('');
                          setEditingSectionId('');
                        }}
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
                {item.contentType === 'FILE' && item.telegramLinkCode && (
                  <div className="inline-upload">
                    <code dir="ltr">{item.telegramLinkCode}</code>
                    <button type="button" onClick={() => void copyLinkCode(item.telegramLinkCode!)}>
                      <Copy size={16} />
                      Copy
                    </button>
                  </div>
                )}
                {item.contentType === 'FILE' && (
                  <form className="inline-upload" onSubmit={(event) => void upload(item.id, event)}>
                    <label>
                      <Paperclip size={16} />
                      <span>إرفاق ملف</span>
                      <input
                        name="file"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*,audio/*,video/mp4,video/webm"
                        multiple
                        required
                      />
                    </label>
                    <button type="submit" disabled={uploadProgress[item.id] !== undefined}>
                      {uploadProgress[item.id] === undefined
                        ? 'رفع'
                        : `رفع ${uploadProgress[item.id]}%`}
                    </button>
                  </form>
                )}
                {item.contentType === 'LINK' && (
                  <form
                    className="inline-upload"
                    onSubmit={(event) => void addLink(item.id, event)}
                  >
                    <label>
                      <Link2 size={16} />
                      <span>إضافة رابط آخر</span>
                      <input
                        name="externalUrl"
                        type="url"
                        dir="ltr"
                        placeholder="https://"
                        required
                      />
                    </label>
                    <button type="submit">إضافة</button>
                  </form>
                )}
                {!!item.attachments.length && (
                  <small className="attachment-count">{item.attachments.length} مرفق</small>
                )}
              </article>
            ))}
          {!inboxItems.length && !filteredItems.some((item) => item.state !== 'ARCHIVED') && (
            <div className="empty-state">لا يوجد محتوى نشط. ابدأ من النموذج المجاور.</div>
          )}
          {filteredItems.some((item) => item.state === 'ARCHIVED') && (
            <details className="archive-drawer">
              <summary>
                <Archive size={17} /> المحتوى المؤرشف{' '}
                <span>{filteredItems.filter((item) => item.state === 'ARCHIVED').length}</span>
              </summary>
              <div className="archive-list">
                {filteredItems
                  .filter((item) => item.state === 'ARCHIVED')
                  .map((item) => (
                    <div className="archive-item" key={item.unifiedId}>
                      <div>
                        <strong>{item.titleAr}</strong>
                        <small>
                          {item.section.course.nameAr} / {item.section.nameAr}
                        </small>
                      </div>
                      <div className="row-actions">
                        <button
                          className="icon-button success"
                          title="استعادة كمسودة"
                          onClick={() => void restore(item.id)}
                        >
                          <ArchiveRestore size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="حذف نهائي"
                          onClick={() => void remove(item.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </details>
          )}
          <nav className="pagination" aria-label="صفحات المحتوى">
            <button
              type="button"
              className="icon-button"
              title="الصفحة السابقة"
              disabled={page <= 1}
              onClick={() => router.push(contentUrl(page - 1))}
            >
              <ChevronRight size={17} />
            </button>
            <span>
              {page} / {Math.max(1, Math.ceil(total / pageSize))} · {total}
            </span>
            <button
              type="button"
              className="icon-button"
              title="الصفحة التالية"
              disabled={page * pageSize >= total}
              onClick={() => router.push(contentUrl(page + 1))}
            >
              <ChevronLeft size={17} />
            </button>
          </nav>
        </div>
        <form className="editor-panel form" onSubmit={create}>
          <div className="section-title">
            <Plus size={18} />
            <h2>محتوى جديد</h2>
          </div>
          <label>
            المادة
            <select
              value={createCourseId}
              onChange={(event) => {
                setCreateCourseId(event.target.value);
                setCreateSectionId('');
              }}
              required
            >
              <option value="">اختر المادة</option>
              {availableCreateCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.nameAr}
                </option>
              ))}
            </select>
          </label>
          {createCourse?.hasSections === false ? (
            <input type="hidden" name="sectionId" value={effectiveCreateSectionId} />
          ) : (
            <label>
              القسم
              <select
                name="sectionId"
                value={createSectionId}
                onChange={(event) => setCreateSectionId(event.target.value)}
                required
                disabled={!createCourseId}
              >
                <option value="">{createCourseId ? 'اختر القسم' : 'اختر المادة أولًا'}</option>
                {createCourseSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.nameAr}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            نوع المحتوى
            <select
              name="contentCategoryId"
              required={createCourse?.hasSections !== false}
              disabled={!effectiveCreateSectionId}
            >
              <option value="">
                {createCourse?.hasSections === false
                  ? 'غير مصنف'
                  : effectiveCreateSectionId
                    ? 'اختر نوع المحتوى'
                    : 'اختر المادة أولًا'}
              </option>
              {createCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameAr}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            العنوان بالعربية
            <input name="titleAr" required />
          </label>
          <label>
            العنوان بالإنجليزية
            <input name="titleEn" dir="ltr" />
          </label>
          <label>
            صيغة المحتوى
            <select
              name="contentType"
              value={createContentType}
              onChange={(event) => setCreateContentType(event.target.value as ContentType)}
              required
            >
              <option value="TEXT">نص</option>
              <option value="LINK">رابط</option>
              <option value="FILE">ملف</option>
            </select>
          </label>
          {createContentType === 'FILE' && (
            <label>
              <span className="field-label-with-icon">
                <Paperclip size={16} /> الملفات (اختياري)
              </span>
              <input
                name="files"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,image/*,audio/*,video/mp4,video/webm"
                multiple
              />
              <small className="muted">
                يمكن اختيار ملف واحد أو عدة ملفات لنفس المحتوى. الحد الأعلى للرفع المباشر{' '}
                {MAX_UPLOAD_MEGABYTES}MB لكل ملف.
              </small>
            </label>
          )}
          <label>
            النص أو الوصف
            <textarea name="bodyText" rows={5} />
          </label>
          <label>
            رابط HTTPS (اختياري)
            <input name="externalUrl" type="url" dir="ltr" placeholder="https://" />
          </label>
          <label>
            ترتيب العرض
            <input name="displayOrder" type="number" min="0" required />
          </label>
          <button className="primary" type="submit" disabled={creating}>
            <Plus size={17} />
            {creating
              ? uploadProgress.create === undefined
                ? 'جارٍ إنشاء المحتوى...'
                : `رفع الملفات ${uploadProgress.create}%`
              : 'حفظ كمسودة'}
          </button>
        </form>
      </section>
    </main>
  );
}
