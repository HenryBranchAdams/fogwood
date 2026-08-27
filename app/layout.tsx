import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://open-surface-lab.madebyhenry.chatgpt.site'),
  applicationName: 'Fogwood',
  title: {
    default: 'Fogwood',
    template: '%s · Fogwood',
  },
  description:
    'A device-local canvas where people and their ChatGPT agent compose the same live artifact through bounded WebMCP tools.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Fogwood',
    title: 'Fogwood — Start with nothing. Make anything.',
    description:
      'One shared canvas where you draw directly and ChatGPT can inspect, compose, and revise through WebMCP.',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Fogwood: Start with nothing. Make anything.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fogwood — Start with nothing. Make anything.',
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
