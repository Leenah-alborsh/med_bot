import { LoaderCircle } from 'lucide-react';

export default function Loading() {
  return (
    <main className="page page-loading" role="status" aria-busy="true">
      <LoaderCircle size={24} aria-hidden="true" />
      <span className="sr-only">Loading</span>
      <div className="loading-placeholder" aria-hidden="true" />
      <div className="loading-placeholder" aria-hidden="true" />
      <div className="loading-placeholder" aria-hidden="true" />
    </main>
  );
}
