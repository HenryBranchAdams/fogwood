'use client';

import dynamic from 'next/dynamic';

const SurfaceApp = dynamic(() => import('./surface-app'), {
  ssr: false,
  loading: () => (
    <main className="surface-loading" aria-label="Loading Fogwood">
      <span />
      <strong>Fogwood</strong>
      <p>Preparing the blank canvas…</p>
    </main>
  ),
});

export default function SurfaceLoader({ licenseKey }: { licenseKey?: string }) {
  return <SurfaceApp licenseKey={licenseKey} />;
}
