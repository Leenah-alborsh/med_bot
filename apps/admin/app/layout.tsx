import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'إدارة منصة الطب',
  description: 'لوحة إدارة منصة بوتات طلاب الطب',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
