import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/AuthContext';
import './globals.css';

export const metadata = { title: 'Ember', description: 'Find your match' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden w-full max-w-full">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen w-full max-w-full overflow-x-hidden relative">
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}



