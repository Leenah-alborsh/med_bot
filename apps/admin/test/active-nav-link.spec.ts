import { createElement, type AnchorHTMLAttributes } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ActiveNavLink } from '../src/components/active-nav-link';

const route = vi.hoisted<{ pathname: string | null }>(() => ({ pathname: '/reports' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', props, children),
}));

describe('current dashboard navigation', () => {
  it.each([
    ['/reports', '/reports', true],
    ['/content', '/content', true],
    ['/admins/123', '/admins', true],
    ['/reports', '/content', false],
    ['/content-types', '/content', false],
    ['/admins-extra', '/admins', false],
    [null, '/reports', false],
  ] as const)('marks %s against %s correctly', (pathname, href, active) => {
    route.pathname = pathname;
    const markup = renderToStaticMarkup(createElement(ActiveNavLink, { href, children: 'Label' }));
    expect(markup.includes('aria-current="page"')).toBe(active);
    expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain('Label');
  });

  it('updates the highlighted item after navigation', () => {
    const render = () =>
      renderToStaticMarkup(createElement(ActiveNavLink, { href: '/reports', children: 'Reports' }));
    route.pathname = '/reports';
    expect(render()).toContain('aria-current="page"');
    route.pathname = '/dashboard';
    expect(render()).not.toContain('aria-current');
  });
});
