import { Keyboard } from 'grammy';

export const BACK_TEXT = '🔙 رجوع';
export const HOME_TEXT = '🏠 القائمة الرئيسية';
export const STAGES = [
  { id: 1, label: 'السنوات الأولى–الثالثة' },
  { id: 4, label: 'السنوات الرابعة–السادسة' },
] as const;

export type NavigationLevel =
  'STAGE' | 'YEAR' | 'SEMESTER' | 'COURSE' | 'CONTENT_CATEGORY' | 'CONTENT';

export type MenuOption = { id: string; label: string };

const PREVIOUS_LEVEL: Record<NavigationLevel, NavigationLevel> = {
  STAGE: 'STAGE',
  YEAR: 'STAGE',
  SEMESTER: 'YEAR',
  COURSE: 'SEMESTER',
  CONTENT_CATEGORY: 'COURSE',
  CONTENT: 'CONTENT_CATEGORY',
};

export const previousLevel = (level: NavigationLevel) => PREVIOUS_LEVEL[level];

const MAX_LABEL_LENGTH = 60;
const TWO_COLUMN_LENGTH = 22;

const trimLabel = (label: string, suffix = '') => {
  const max = MAX_LABEL_LENGTH - suffix.length;
  return `${label.trim().slice(0, max)}${suffix}`;
};

export function visibleOptions(rows: Array<{ id: string; label: string }>): MenuOption[] {
  const totals = new Map<string, number>();
  rows.forEach(({ label }) => totals.set(label.trim(), (totals.get(label.trim()) ?? 0) + 1));
  const seen = new Map<string, number>();
  return rows.map(({ id, label }) => {
    const normalized = label.trim();
    const index = (seen.get(normalized) ?? 0) + 1;
    seen.set(normalized, index);
    const suffix = (totals.get(normalized) ?? 0) > 1 ? ` · ${index}` : '';
    return { id, label: trimLabel(normalized, suffix) };
  });
}

export function resolveVisibleOption(text: string, options: MenuOption[]) {
  const matches = options.filter(({ label }) => label === text);
  return matches.length === 1 ? matches[0] : null;
}

export function navigationKeyboard(options: MenuOption[], includeBack = true) {
  const keyboard = new Keyboard();
  for (let index = 0; index < options.length;) {
    const first = options[index++]!;
    keyboard.text(first.label);
    const second = options[index];
    if (
      second &&
      first.label.length <= TWO_COLUMN_LENGTH &&
      second.label.length <= TWO_COLUMN_LENGTH
    ) {
      keyboard.text(second.label);
      index += 1;
    }
    if (index < options.length || includeBack) keyboard.row();
  }
  if (includeBack) keyboard.text(BACK_TEXT).text(HOME_TEXT);
  return keyboard.resized().persistent();
}

export const stageKeyboard = () =>
  navigationKeyboard(
    STAGES.map(({ id, label }) => ({ id: String(id), label })),
    false,
  );
