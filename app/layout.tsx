import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Open Surface',
  description:
    'A blank tldraw canvas that ChatGPT can compose into the interface you need.',
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
