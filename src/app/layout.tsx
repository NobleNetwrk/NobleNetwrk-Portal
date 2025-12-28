// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { SolanaProvider } from '@/components/SolanaProvider';
import ToastProvider from '@/providers/ToastProvider';
import dynamic from 'next/dynamic';
import Image from 'next/image';

// Added display: 'swap' to help with loading issues
const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap' 
});

const WalletConnectDynamic = dynamic(
  () => import('@/components/WalletConnect'),
  { 
    ssr: false, 
    loading: () => <div className="h-10 w-32 bg-gray-800 animate-pulse rounded-lg" /> 
  }
);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-gray-950 text-gray-100 min-h-screen flex flex-col font-sans">
        <SolanaProvider>
          <ToastProvider> 
            {/* Header / Navigation */}
            <nav className="w-full p-4 flex justify-between items-center bg-gray-900/50 backdrop-blur-md sticky top-0 z-50 border-b border-gray-800">
              <div className="flex items-center gap-3">
                 {/* Logo Container: Ensure it has a fixed height/width to prevent "funny" layout shifts */}
                 <div className="relative w-10 h-10 flex-shrink-0">
                    <Image
                      src="/ntwrk-logo.png"
                      alt="NobleNetwrk Logo"
                      fill
                      sizes="40px"
                      className="object-contain"
                      priority
                    />
                 </div>
                 <span className="font-black tracking-tighter text-xl whitespace-nowrap">
                   NobleNetwrk Portal
                 </span>
              </div>
              <WalletConnectDynamic />
            </nav>
            
            {/* Main Content Area */}
            <main className="flex-grow container mx-auto px-4 py-8">
              {children}
            </main>
            
            {/* Footer */}
            <footer className="p-8 text-center text-gray-600 text-sm border-t border-gray-900">
              © {new Date().getFullYear()} NobleNetwrk Portal.
            </footer>
          </ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}