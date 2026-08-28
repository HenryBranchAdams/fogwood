import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://fogwood.madebyhenry.chatgpt.site'),
  applicationName: 'Fogwood',
  title: {
    default: 'Fogwood',
    template: '%s · Fogwood',
  },
  description:
    'A blank device-local tldraw canvas that Codex can shape through a bounded, human-reviewed WebMCP protocol.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Fogwood',
    title: 'Fogwood — A canvas Codex can shape.',
    description:
      'An empty tldraw surface with a composable, human-reviewed WebMCP Canvas Protocol.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Fogwood: a canvas Codex can shape.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fogwood — A canvas Codex can shape.',
    description:
      'An empty tldraw surface with a composable, human-reviewed WebMCP Canvas Protocol.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
