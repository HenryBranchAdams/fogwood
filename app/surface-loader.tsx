'use client';

import dynamic from 'next/dynamic';

const SurfaceApp = dynamic(() => import('./surface-app'), {
  ssr: false,
  loading: () => (
    <main className="surface-loading" aria-label="Loading Open Surface">
      <span />
      <strong>Open Surface</strong>
      <p>Preparing the blank canvas…</p>
    </main>
  ),
});

export default function SurfaceLoader({ licenseKey }: { licenseKey?: string }) {
  return <SurfaceApp licenseKey={licenseKey} />;
}
