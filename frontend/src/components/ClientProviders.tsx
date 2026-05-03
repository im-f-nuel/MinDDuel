'use client'

import { ToastProvider } from '@/components/ui/Toast'

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
