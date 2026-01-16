// src/components/LoadingSpinner.tsx
import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  color?: string
}

export default function LoadingSpinner({ 
  size = 'md', 
  className = '',
  color = 'border-purple-500'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[3px]',
    lg: 'h-12 w-12 border-4'
  }

  return (
    <div 
      className={`inline-block ${sizeClasses[size]} border-t-transparent ${color} rounded-full animate-spin ${className}`} 
      aria-label="Loading"
    />
  )
}