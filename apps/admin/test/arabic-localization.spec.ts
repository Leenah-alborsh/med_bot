import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const adminRoot = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === '.next' || name === 'node_modules') return [];
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(name)
        ? [path]
        : [];
  });

describe('Arabic admin localization', () => {
  it('contains no literal Unicode escapes that React could render verbatim', () => {
    for (const path of sourceFiles(adminRoot)) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/\\u[0-9a-f]{4}/i);
    }
  });

  it('stores key interface labels as real Arabic text', () => {
    const layout = readFileSync(join(adminRoot, 'app', '(protected)', 'layout.tsx'), 'utf8');
    const catalog = readFileSync(
      join(adminRoot, 'src', 'components', 'catalog-manager.tsx'),
      'utf8',
    );
    const content = readFileSync(
      join(adminRoot, 'src', 'components', 'content-manager.tsx'),
      'utf8',
    );

    expect(layout).toContain('Medical Students Hub');
    expect(layout).toContain('المشرفون');
    expect(catalog).toContain('الاسم بالإنجليزية');
    expect(content).toContain('حفظ كمسودة');
  });
});
