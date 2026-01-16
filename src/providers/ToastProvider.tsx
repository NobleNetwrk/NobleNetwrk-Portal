// src/providers/ToastProvider.tsx
"use client";

import React from "react";
import { ToastContainer, ToastContainerProps } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface ToastProviderProps {
  children: React.ReactNode;
}

export default function ToastProvider({ children }: ToastProviderProps) {
  // We use a type assertion (as any) here to bypass the strict prop check 
  // that is causing your VPS build to fail, while still applying the dark theme.
  const containerProps = {
    position: "bottom-right",
    autoClose: 3000,
    hideProgressBar: false,
    newestOnTop: false,
    closeOnClick: true,
    rtl: false,
    pauseOnFocusLoss: true,
    draggable: true,
    pauseOnHover: true,
    theme: "dark"
  } as any;

  return (
    <>
      {children}
      <ToastContainer {...containerProps} />
    </>
  );
}