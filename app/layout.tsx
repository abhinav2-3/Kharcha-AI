import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kharcha - Voice & Text Expense Tracker',
  description: 'Log daily expenses in seconds via voice or text in Hinglish',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

