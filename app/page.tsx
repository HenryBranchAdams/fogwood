import SurfaceLoader from './surface-loader';

export default function Home() {
  return <SurfaceLoader licenseKey={process.env.TLDRAW_LICENSE_KEY} />;
}
