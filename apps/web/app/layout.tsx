import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { OverlayProvider } from '@/contexts/OverlayContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'Analytics Dashboard',
  description: 'Privacy-first analytics platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OverlayProvider>
            {children}
            <Toaster />
          </OverlayProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

