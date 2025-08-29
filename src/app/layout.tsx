import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Android Remote Control',
  description: 'Control your Android device remotely through web browser with real-time screen mirroring, touch control, and file transfer.',
  keywords: ['android', 'remote control', 'screen mirroring', 'webrtc', 'touch control'],
  authors: [{ name: 'Android Remote Control Team' }],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}