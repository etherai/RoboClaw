'use client'

import { useState } from 'react'
import Button from './Button'
import { Loader2 } from 'lucide-react'

interface SetupTerminalProps {
  url: string
  onComplete: () => void
}

export default function SetupTerminal({ url, onComplete }: SetupTerminalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6">
        <h2 className="text-2xl font-bold mb-4">OpenClaw Onboarding</h2>
        <p className="text-gray-400 mb-6">
          Complete the onboarding wizard in the terminal below. When you're done, click the "I'm Done" button.
        </p>

        {/* Terminal Iframe Container */}
        <div className="relative bg-terminal-bg border-2 border-white/20 rounded-lg overflow-hidden mb-6" style={{ height: '600px' }}>
          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg z-10">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-accent-purple animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading terminal...</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg z-20">
              <div className="text-center p-6 bg-red-900/20 border border-red-500/50 rounded-lg max-w-md">
                <div className="text-red-400 mb-4">
                  <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-lg font-semibold">Failed to connect to terminal</p>
                </div>
                <p className="text-sm text-gray-300 mb-4">
                  The terminal connection could not be established. This may be due to a network issue or the server not being ready.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-accent-purple hover:bg-accent-purple/80 rounded-lg text-white transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          )}

          {/* Iframe */}
          <iframe
            src={url}
            className="w-full h-full"
            title="OpenClaw Onboarding Terminal"
            onLoad={() => {
              setIsLoading(false)
              // Check if iframe loaded an error page
              try {
                const iframe = document.querySelector('iframe')
                const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document
                if (iframeDoc?.title?.toLowerCase().includes('error') ||
                    iframeDoc?.body?.textContent?.toLowerCase().includes('connection failed')) {
                  setHasError(true)
                }
              } catch (e) {
                // Cross-origin errors are expected and mean it's working
              }
            }}
            onError={() => setHasError(true)}
          />
        </div>

        {/* Completion Button */}
        <div className="flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={onComplete}
            className="px-12"
          >
            I'm Done - Complete Setup
          </Button>
        </div>

        <p className="text-sm text-gray-500 text-center mt-4">
          Click the button above after completing the onboarding wizard
        </p>
      </div>
    </div>
  )
}
