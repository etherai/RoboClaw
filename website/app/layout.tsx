import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import Footer from '@/components/ui/Footer'

export const metadata: Metadata = {
  title: 'RoboClaw Community Edition',
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
        <nav className="border-b border-white/10 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent-purple to-accent-blue">
                RoboClaw Community Edition
              </a>
              <div className="flex items-center gap-6">
                <a href="/" className="text-gray-300 hover:text-white transition-colors">
                  Home
                </a>
                <a href="https://github.com/etherai/roboclaw" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">
                  GitHub
                </a>
                <a href="https://discord.gg/8DaPXhRFfv" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">
                  Discord
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
