'use client'

import { type Instance } from '@/types'
import Badge from './Badge'
import Button from './Button'
import { Copy, Server, CheckCircle2, AlertCircle, Terminal, Trash2, Loader2, Plug, Unplug, RefreshCw, ExternalLink, Power, MoreVertical } from 'lucide-react'
import DropdownMenu from './DropdownMenu'

interface InstanceCardProps {
  instance: Instance
  onSetupClick: (instanceName: string) => void
  onDeleteClick: (instanceName: string) => void
  onTunnelToggle: (instanceName: string) => void
  onReconfigureClick: (instanceName: string) => void
  onServiceToggle: (instanceName: string) => void
  isDeleting?: boolean
  tunnelStatus?: 'connected' | 'disconnected' | 'connecting' | 'disconnecting'
  serviceStatus?: 'active' | 'inactive' | 'failed' | 'unknown' | 'loading'
}

export default function InstanceCard({ instance, onSetupClick, onDeleteClick, onTunnelToggle, onReconfigureClick, onServiceToggle, isDeleting = false, tunnelStatus = 'disconnected', serviceStatus = 'unknown' }: InstanceCardProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getStatusVariant = (): 'success' | 'error' | 'pending' | 'running' => {
    if (instance.status === 'deleted') return 'error'
    if (instance.onboardingCompleted) return 'success'
    return 'pending'
  }

  const getStatusLabel = (): string => {
    if (instance.status === 'deleted') return 'Deleted'
    if (instance.onboardingCompleted) return 'Configured'
    return 'Setup Required'
  }

  const sshCommand = `ssh -i ${instance.ssh.keyFile} root@${instance.ip}`

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:border-white/20 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-accent-purple/20 rounded-lg">
              <Server className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{instance.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm text-gray-400">{instance.ip}</code>
                <button
                  onClick={() => copyToClipboard(instance.ip)}
                  className="p-1 hover:bg-white/10 rounded"
                  title="Copy IP"
                >
                  <Copy className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant()}>{getStatusLabel()}</Badge>
          {instance.status === 'active' && (
            <DropdownMenu
              variant="minimal"
              trigger={<MoreVertical className="w-4 h-4 text-gray-400" />}
              items={[
                ...(instance.onboardingCompleted ? [{
                  label: 'Repair',
                  onClick: () => onReconfigureClick(instance.name),
                  icon: <RefreshCw className="w-4 h-4" />,
                  variant: 'default' as const,
                }] : []),
                {
                  label: isDeleting ? 'Deleting...' : 'Delete Instance',
                  onClick: () => onDeleteClick(instance.name),
                  icon: isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />,
                  variant: 'danger',
                  disabled: isDeleting,
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Server Info */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Type:</span>{' '}
          <span className="text-white">{instance.serverType}</span>
        </div>
        <div>
          <span className="text-gray-400">Location:</span>{' '}
          <span className="text-white">{instance.location}</span>
        </div>
      </div>

      {/* Software Versions */}
      <div className="bg-terminal-bg rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-400 mb-2">Installed Software</div>
        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
          <div className="text-gray-300">
            Docker: <span className="text-terminal-success">{instance.software.docker.split(' ')[2] || instance.software.docker}</span>
          </div>
          <div className="text-gray-300">
            Node.js: <span className="text-terminal-success">{instance.software.nodejs}</span>
          </div>
          <div className="text-gray-300">
            pnpm: <span className="text-terminal-success">{instance.software.pnpm}</span>
          </div>
          <div className="text-gray-300">
            RoboClaw: <span className="text-terminal-success">{instance.software.roboclaw}</span>
          </div>
          {instance.software.gemini && (
            <div className="text-gray-300">
              Gemini: <span className="text-terminal-success">{instance.software.gemini}</span>
            </div>
          )}
        </div>
      </div>

      {/* OpenClaw Service Status */}
      {instance.status === 'active' && instance.onboardingCompleted && (
        <div className="flex items-center justify-between bg-terminal-bg rounded-lg px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">OpenClaw Service</span>
            {serviceStatus === 'failed' && (
              <span className="text-xs text-terminal-error">(failed)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {serviceStatus === 'loading' ? '' :
               serviceStatus === 'active' ? 'Running' :
               serviceStatus === 'failed' ? 'Failed' :
               'Stopped'}
            </span>
            <button
              role="switch"
              aria-checked={serviceStatus === 'active'}
              aria-label="Toggle OpenClaw service"
              onClick={() => onServiceToggle(instance.name)}
              disabled={serviceStatus === 'loading' || serviceStatus === 'unknown'}
              className={`
                relative inline-flex items-center rounded-full transition-colors duration-200 w-9 h-5
                focus:outline-none focus:ring-2 focus:ring-accent-purple/50 focus:ring-offset-2 focus:ring-offset-background
                disabled:opacity-50 disabled:cursor-not-allowed
                ${serviceStatus === 'active' ? 'bg-terminal-success' : 'bg-white/20'}
              `}
            >
              <span
                className={`
                  inline-block rounded-full bg-white transition-transform duration-200 shadow-sm h-4 w-4
                  ${serviceStatus === 'active' ? 'translate-x-4' : 'translate-x-0.5'}
                `}
              />
              {serviceStatus === 'loading' && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Provisioned At */}
      <div className="text-xs text-gray-500 mb-4">
        Provisioned {new Date(instance.provisionedAt).toLocaleString()}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-center">
        {instance.status === 'active' && !instance.onboardingCompleted && (
          <Button
            variant="primary"
            onClick={() => onSetupClick(instance.name)}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Setup RoboClaw
          </Button>
        )}

        {instance.status === 'active' && instance.onboardingCompleted && (
          <>
            <button
              onClick={() => onTunnelToggle(instance.name)}
              disabled={tunnelStatus === 'connecting' || tunnelStatus === 'disconnecting'}
              className={`px-4 py-2 border rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                tunnelStatus === 'connected'
                  ? 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 hover:border-green-500/50 text-green-400'
                  : 'bg-accent-purple/10 hover:bg-accent-purple/20 border-accent-purple/30 hover:border-accent-purple/50 text-accent-purple'
              }`}
              title={tunnelStatus === 'connected' ? 'Disconnect tunnel' : 'Connect tunnel'}
            >
              {tunnelStatus === 'connecting' || tunnelStatus === 'disconnecting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tunnelStatus === 'connecting' ? 'Connecting...' : 'Disconnecting...'}
                </>
              ) : tunnelStatus === 'connected' ? (
                <>
                  <Unplug className="w-4 h-4" />
                  Disconnect
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect
                </>
              )}
            </button>

            {tunnelStatus === 'connected' && (
              <a
                href={instance.gatewayToken ? `http://localhost:18789?token=${instance.gatewayToken}` : "http://localhost:18789"}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 hover:border-accent-cyan/50 text-accent-cyan hover:text-accent-cyan rounded-lg transition-colors text-sm flex items-center gap-2 whitespace-nowrap"
                title="Open Gateway"
              >
                <ExternalLink className="w-4 h-4" />
                Gateway
              </a>
            )}
          </>
        )}

        {instance.status === 'deleted' && (
          <div className="flex-1 flex items-center gap-2 text-sm text-terminal-error">
            <AlertCircle className="w-4 h-4" />
            <span>Instance deleted</span>
          </div>
        )}
      </div>
    </div>
  )
}
