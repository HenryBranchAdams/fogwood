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
    'A device-local generative medium where people and Codex turn capabilities into editable native matter through bounded WebMCP tools.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Fogwood',
    title: 'Fogwood — Start with a ball of clay.',
    description:
      'One shared canvas where you sketch, branch, and revise native shapes with Codex through WebMCP.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Fogwood: Start with a ball of clay.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fogwood — Start with a ball of clay.',
    description:
      'A shared tldraw canvas where people and Codex shape an editable composition through WebMCP.',
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
