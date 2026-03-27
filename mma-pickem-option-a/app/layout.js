export const metadata = {
  title: 'MMA Pick\'Em',
  description: 'Simple UFC pick\'em site for friends'
};

import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
