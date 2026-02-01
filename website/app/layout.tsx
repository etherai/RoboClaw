import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OpenClaw - Deploy in 2 Minutes',
  description: 'One-click deployment of OpenClaw on Hetzner Cloud VPS',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b border-white/10 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent-purple to-accent-blue">
                OpenClaw Deploy
              </a>
              <div className="flex items-center gap-6">
                <a href="/" className="text-gray-300 hover:text-white transition-colors">
                  Home
                </a>
                <a href="/deploy" className="text-gray-300 hover:text-white transition-colors">
                  Deploy
                </a>
                <a href="/instances" className="text-gray-300 hover:text-white transition-colors">
                  Instances
                </a>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
