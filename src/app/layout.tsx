// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'NobleNetwrk Portal',
  description: 'Manage your Noble assets, Airdrops, and K9 Impounds.',
  icons: {
    icon: '/favicon.ico', 
    shortcut: '/favicon.ico',
    apple: '/ntwrk-logo.png', 
  },
}

// Updated loading state to match the gold theme (Gold accent pulse)
const WalletConnectDynamic = dynamic(
  () => import('@/components/WalletConnect'),
  { 
    ssr: false, 
    loading: () => <div className="h-12 w-48 bg-[#c5a059]/20 animate-pulse rounded-xl" /> 
  }
);

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      {/* BACKGROUND CHANGED: Deep Noble Black */}
      <body className="bg-[#0a0a0b] text-white min-h-screen flex flex-col font-sans">
        <SolanaProvider>
          <ToastProvider> 
            
            {/* Header: Darker blur with subtle white border */}
            <nav className="w-full px-6 py-5 flex justify-between items-center bg-[#0a0a0b]/80 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
              <div className="flex items-center gap-4">
                  {/* Logo Container */}
                  <div className="relative w-10 h-10 flex-shrink-0">
                    <Image
                      src="/ntwrk-logo.png"
                      alt="NobleNetwrk Logo"
                      fill
                      sizes="40px"
                      className="object-contain drop-shadow-[0_0_10px_rgba(197,160,89,0.3)]" // Added subtle gold glow
                      priority
                    />
                  </div>
                  
                  {/* Desktop Title */}
                  <span className="hidden md:block font-black tracking-widest text-xl whitespace-nowrap uppercase">
                    Noble<span className="text-[#c5a059]">Netwrk</span> Portal
                  </span>
                  
                  {/* Mobile Title */}
                  <span className="md:hidden font-black tracking-widest text-lg text-[#c5a059]">
                    Portal
                  </span>
              </div>
              
              {/* Wallet Button */}
              <WalletConnectDynamic />
            </nav>
            
            {/* Main Content Area */}
            <main className="flex-grow container mx-auto px-4 py-8 relative">
               {/* Optional: Add ambient background glow effects like the Social Club */}
               <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#c5a059]/5 rounded-full blur-[120px] pointer-events-none -z-10" />
               
               {children}
            </main>
            
            {/* Footer: Gold/Gray text */}
            <footer className="p-8 text-center text-gray-500 text-[10px] font-black uppercase tracking-[0.3em] border-t border-white/5">
              © {new Date().getFullYear()} Noble Netwrk • Decentralized Genetics
            </footer>
          </ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}