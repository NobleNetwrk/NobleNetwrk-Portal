// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { SolanaProvider } from '@/components/SolanaProvider';
import ToastProvider from '@/providers/ToastProvider'; // Import the new provider
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const WalletConnectDynamic = dynamic(
  () => import('@/components/WalletConnect'),
  { ssr: false, loading: () => <div className="h-10 w-32 bg-gray-800 animate-pulse rounded-lg" /> }
);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-gray-950 text-gray-100 min-h-screen flex flex-col font-sans">
        <SolanaProvider>
          {/* ToastProvider should be inside SolanaProvider to access wallet context if needed later */}
          <ToastProvider> 
            <nav className="w-full p-4 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-50 border-b border-gray-800">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20" />
                 <span className="font-black tracking-tighter text-xl ">NobleNetwrk Portal</span>
              </div>
              <WalletConnectDynamic />
            </nav>
            
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            
            <footer className="p-8 text-center text-gray-600 text-sm border-t border-gray-900">
              © {new Date().getFullYear()} NobleNetwrk Portal.
            </footer>
          </ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}