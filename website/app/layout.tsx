import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Footer from '@/components/ui/Footer'
import Navbar from '@/components/ui/Navbar'

export const metadata: Metadata = {
  title: 'RoboClaw',
  description: 'One-click deployment of RoboClaw on Hetzner Cloud VPS',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        {/* Privacy-friendly analytics by Plausible */}
        <Script
          src="https://plausible.io/js/pa-isqcaB2Pz2E0hTYv_lrro.js"
          strategy="afterInteractive"
          async
        />
        <Script id="plausible-init" strategy="afterInteractive">
          {`
            window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
            plausible.init()
          `}
        </Script>
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
