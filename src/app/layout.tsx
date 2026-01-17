// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import type { Metadata } from 'next'; // <--- IMPORT THIS
import { Inter } from 'next/font/google';
import { SolanaProvider } from '@/components/SolanaProvider';
import ToastProvider from '@/providers/ToastProvider';
import dynamic from 'next/dynamic';
import Image from 'next/image';

const inter = Inter({ 
  subsets: ['latin'], 
  variable: '--font-inter',
  display: 'swap' 
});

// --- FIX: DEFINE SITE METADATA HERE ---
export const metadata: Metadata = {
  title: 'NobleNetwrk Portal',
  description: 'Manage your Noble assets, Airdrops, and K9 Impounds.',
  icons: {
    icon: '/favicon.ico', // <--- Uses your specific file
    shortcut: '/favicon.ico',
    apple: '/ntwrk-logo.png', // Optional: You can use ntwrk-logo.png here if you want high-res for iPhones
  },
}

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
      {/* Logo Container */}
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
      
      {/* FIX: Hide text on mobile, show on Tablet/Desktop (md:block) */}
      <span className="hidden md:block font-black tracking-tighter text-xl whitespace-nowrap">
        NobleNetwrk Portal
      </span>
      
      {/* Optional: Show a shorter name on mobile if you want */}
      <span className="md:hidden font-black tracking-tighter text-lg text-gray-400">
        Portal
      </span>
  </div>
  
  {/* Wallet Button */}
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