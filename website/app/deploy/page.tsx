'use client'

import { useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import { useDeploymentStream } from '@/hooks/useDeploymentStream'
import { Copy, Download, CheckCircle2, XCircle, Terminal as TerminalIcon, ChevronDown, ChevronUp, Rocket, Server, Zap } from 'lucide-react'
import type { LogEntry } from '@/lib/types'

export default function DeployPage() {
  const [token, setToken] = useState('')
  const [serverName, setServerName] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [showConsole, setShowConsole] = useState(false)
  const { logs, phase, progress, result, error, isDeploying, startDeploy, reset } = useDeploymentStream()

  const handleDeploy = () => {
    // Validate token exists
    if (!token || token.trim() === '') {
      setTokenError('Please enter a Hetzner API token')
      return
    }

    setTokenError('')
    startDeploy({ token, serverName: serverName || undefined })
  }

  const handleReset = () => {
    reset()
    setToken('')
    setServerName('')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadPrivateKey = () => {
    if (!result) return
    const blob = new Blob([result.sshPrivateKey], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openclaw_key'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Deploy Open Claw</h1>
            <p className="text-gray-400">
              Automated VPS provisioning with real-time deployment logs
            </p>
          </div>

          {/* Token Input Form (shown when not deploying and no result) */}
          {!isDeploying && !result && !error && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8">
                <h2 className="text-2xl font-semibold mb-6">Configuration</h2>
                <div className="space-y-4">
                  <Input
                    label="Hetzner API Token"
                    type="password"
                    placeholder="Paste your Hetzner Cloud API token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    error={tokenError}
                    helperText="Create a token at https://console.hetzner.cloud with Read & Write permissions"
                  />
                  <Input
                    label="Server Name (optional)"
                    type="text"
                    placeholder="Auto-generated if not provided"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    helperText="A unique name for your VPS instance"
                  />
                  <Button onClick={handleDeploy} className="w-full mt-6" size="lg">
                    Launch Deployment
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Deployment View */}
          {(isDeploying || result || error) && (
            <div className="max-w-5xl mx-auto">
              {result ? (
                <SuccessPanel result={result} onCopy={copyToClipboard} onDownload={downloadPrivateKey} onReset={handleReset} />
              ) : error ? (
                <ErrorPanel error={error} onReset={handleReset} />
              ) : (
                <>
                  {/* Central Step Tracker */}
                  <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg border border-white/20 rounded-2xl p-8 mb-6 shadow-2xl">
                    {/* Header with Icon */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                      <div className="relative">
                        <Rocket className="w-10 h-10 text-accent-purple animate-bounce" />
                        <div className="absolute -inset-2 bg-accent-purple/20 rounded-full blur-xl animate-pulse"></div>
                      </div>
                      <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent-purple to-accent-blue">
                        Deploying Your Server
                      </h2>
                    </div>

                    {/* Progress Bar */}
                    {phase && (
                      <div className="mb-8">
                        <div className="flex items-center justify-between text-sm mb-3">
                          <span className="text-gray-300 font-medium">{phase.label}</span>
                          <span className="text-accent-blue font-bold text-lg">{progress}%</span>
                        </div>
                        <div className="relative w-full bg-white/10 rounded-full h-4 overflow-hidden">
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-accent-purple via-accent-blue to-accent-purple h-4 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visual Step Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {DEPLOYMENT_PHASES.map((p, idx) => {
                        const isComplete = phase && idx < phase.step
                        const isCurrent = phase && idx === phase.step - 1
                        const isPending = !phase || idx >= phase.step

                        return (
                          <div
                            key={p.phase}
                            className={`relative group transition-all duration-500 ${
                              isCurrent ? 'scale-110' : ''
                            }`}
                          >
                            <div
                              className={`relative p-4 rounded-xl border-2 transition-all duration-500 ${
                                isComplete
                                  ? 'bg-terminal-success/20 border-terminal-success shadow-lg shadow-terminal-success/20'
                                  : isCurrent
                                  ? 'bg-accent-purple/20 border-accent-purple shadow-lg shadow-accent-purple/30 animate-pulse-slow'
                                  : 'bg-white/5 border-white/10'
                              }`}
                            >
                              {/* Icon/Number */}
                              <div className="flex items-center justify-center mb-3">
                                <div
                                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-500 ${
                                    isComplete
                                      ? 'bg-terminal-success text-black'
                                      : isCurrent
                                      ? 'bg-gradient-to-br from-accent-purple to-accent-blue text-white'
                                      : 'bg-white/10 text-gray-500'
                                  }`}
                                >
                                  {isComplete ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                  ) : isCurrent ? (
                                    <Zap className="w-6 h-6 animate-pulse" />
                                  ) : (
                                    <Server className="w-6 h-6" />
                                  )}
                                </div>
                              </div>

                              {/* Label */}
                              <p
                                className={`text-center text-xs font-medium transition-colors duration-500 ${
                                  isComplete
                                    ? 'text-terminal-success'
                                    : isCurrent
                                    ? 'text-white'
                                    : 'text-gray-500'
                                }`}
                              >
                                {p.label}
                              </p>

                              {/* Glow effect for current */}
                              {isCurrent && (
                                <div className="absolute -inset-1 bg-gradient-to-r from-accent-purple to-accent-blue rounded-xl blur opacity-30 animate-pulse"></div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Expandable Console */}
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setShowConsole(!showConsole)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <TerminalIcon className="w-5 h-5 text-accent-blue" />
                        <span className="font-medium">Deployment Console</span>
                        <Badge variant="secondary">{logs.length} logs</Badge>
                      </div>
                      {showConsole ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {showConsole && <TerminalView logs={logs} />}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DEPLOYMENT_PHASES = [
  { phase: 'keygen', label: 'Generate SSH keypair' },
  { phase: 'ssh_key', label: 'Upload SSH key' },
  { phase: 'provisioning', label: 'Create VPS instance' },
  { phase: 'ssh_wait', label: 'Wait for SSH' },
  { phase: 'install_packages', label: 'Install base packages' },
  { phase: 'create_user', label: 'Create openclaw user' },
  { phase: 'install_docker', label: 'Install Docker' },
  { phase: 'configure_firewall', label: 'Configure firewall' },
  { phase: 'install_nodejs', label: 'Install Node.js' },
  { phase: 'install_openclaw', label: 'Install OpenClaw' },
  { phase: 'verify', label: 'Verify installation' },
  { phase: 'success', label: 'Complete' },
]

function TerminalView({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="p-4 font-mono text-sm max-h-[400px] overflow-y-auto space-y-1 bg-terminal-bg">
      {logs.map((log, idx) => (
        <div key={idx} className={getLogColor(log.level)}>
          <span className="text-gray-600 mr-2">
            [{new Date(log.timestamp).toLocaleTimeString()}]
          </span>
          {log.message}
        </div>
      ))}
      {logs.length === 0 && (
        <div className="text-gray-500">Waiting for deployment to start...</div>
      )}
    </div>
  )
}

function SuccessPanel({ result, onCopy, onDownload, onReset }: any) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-terminal-success/30 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <CheckCircle2 className="w-10 h-10 text-terminal-success" />
        <div>
          <h2 className="text-2xl font-bold">Deployment Successful!</h2>
          <p className="text-gray-400">Your VPS is ready to use</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-terminal-bg rounded-lg p-4 border border-white/10">
          <label className="text-sm text-gray-400 block mb-2">Server IP Address</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-terminal-success font-mono">{result.ip}</code>
            <button onClick={() => onCopy(result.ip)} className="p-2 hover:bg-white/10 rounded">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-terminal-bg rounded-lg p-4 border border-white/10">
          <label className="text-sm text-gray-400 block mb-2">SSH Command</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-terminal-command font-mono text-sm">
              ssh -i openclaw_key root@{result.ip}
            </code>
            <button onClick={() => onCopy(`ssh -i openclaw_key root@${result.ip}`)} className="p-2 hover:bg-white/10 rounded">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <Button onClick={onDownload} variant="primary" className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Download SSH Private Key
        </Button>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Save your SSH key now</p>
          <p className="text-gray-400 text-sm">The private key will not be shown again. Download it and save it securely.</p>
        </div>

        <div className="pt-4 border-t border-white/10">
          <h3 className="font-semibold mb-3">Next Steps:</h3>
          <ol className="space-y-2 text-sm text-gray-400">
            {result.nextSteps.map((step: string, idx: number) => (
              <li key={idx} className="flex gap-2">
                <span className="text-accent-purple font-mono">{idx + 1}.</span>
                <code className="text-terminal-command">{step}</code>
              </li>
            ))}
          </ol>
        </div>

        <Link href="/instances">
          <Button variant="primary" className="w-full mt-6">
            View in Dashboard
          </Button>
        </Link>

        <Button onClick={onReset} variant="secondary" className="w-full">
          Deploy Another Instance
        </Button>
      </div>
    </div>
  )
}

function ErrorPanel({ error, onReset }: any) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-terminal-error/30 rounded-xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <XCircle className="w-10 h-10 text-terminal-error" />
        <div>
          <h2 className="text-2xl font-bold">Deployment Failed</h2>
          <p className="text-gray-400">An error occurred during deployment</p>
        </div>
      </div>

      <div className="bg-terminal-bg rounded-lg p-4 border border-terminal-error/30 mb-6">
        <p className="text-terminal-error font-mono text-sm">{error.message}</p>
      </div>

      <div className="space-y-3">
        <Button onClick={onReset} variant="primary" className="w-full">
          Try Again
        </Button>
        <Button variant="secondary" className="w-full">
          Report Issue
        </Button>
      </div>
    </div>
  )
}

function getLogColor(level: string): string {
  switch (level) {
    case 'error':
      return 'text-terminal-error'
    case 'success':
      return 'text-terminal-success'
    case 'warning':
      return 'text-terminal-warning'
    case 'command':
      return 'text-terminal-command'
    default:
      return 'text-terminal-text'
  }
}
