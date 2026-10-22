import './globals.css';

export const metadata = {
  title: 'Sumit Pawse',
  description: 'Track your expenses and amounts.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
