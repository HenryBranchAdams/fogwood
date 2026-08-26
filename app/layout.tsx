import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://open-surface-lab.madebyhenry.chatgpt.site'),
  applicationName: 'Open Surface',
  title: {
    default: 'Open Surface',
    template: '%s · Open Surface',
  },
  description:
    'A blank tldraw canvas where people and their ChatGPT agent compose the same live artifact through WebMCP.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Open Surface',
    title: 'Open Surface — Start with nothing. Make anything.',
    description:
      'One shared canvas where you draw directly and ChatGPT can inspect, compose, and revise through WebMCP.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Open Surface: Start with nothing. Make anything.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Open Surface — Start with nothing. Make anything.',
    description:
      'A shared tldraw canvas for people and their ChatGPT agent, connected through WebMCP.',
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
