'use client'

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the WalletConnect component
const WalletConnectDynamic = dynamic(
  () => import('./WalletConnect'),
  { ssr: false }
);

export default function Header() {
  return (
    <header className="w-full p-4 flex justify-end bg-white shadow-sm">
      <WalletConnectDynamic />
    </header>
  );
}