import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter } from 'next/font/google'

import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Lanta Pilates',
  description: 'On-demand reformer Pilates — your way, every day.',
  applicationName: 'Lanta Pilates',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lanta Pilates',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#f9f7f5',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} h-full`}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
