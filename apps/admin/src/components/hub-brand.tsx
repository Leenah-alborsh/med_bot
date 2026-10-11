import Link from 'next/link';
import { BookHeart } from 'lucide-react';

export function HubBrand() {
  return (
    <Link className="brand" href="/dashboard" aria-label="Medical Students Hub - الرئيسية">
      <span className="brand-mark">
        <BookHeart size={27} strokeWidth={1.8} />
      </span>
      <span className="brand-copy">
        <strong>Medical Students Hub</strong>
        <small>بوابة المحتوى التعليمي</small>
      </span>
    </Link>
  );
}
