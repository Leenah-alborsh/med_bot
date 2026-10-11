'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createElement, type ReactNode } from 'react';

export function ActiveNavLink({
  href,
  children,
  title,
}: {
  href: string;
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(`${href}/`);
  return createElement(
    Link,
    { href, title, 'aria-label': title, 'aria-current': active ? 'page' : undefined },
    children,
  );
}
