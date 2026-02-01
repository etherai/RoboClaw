'use client'

import { type Instance } from '@/lib/types'
import Badge from './Badge'
import Button from './Button'
import { Copy, Server, CheckCircle2, AlertCircle, Terminal, Trash2, Loader2 } from 'lucide-react'

interface InstanceCardProps {
  instance: Instance
  onSetupClick: (instanceName: string) => void
  onDeleteClick: (instanceName: string) => void
  isDeleting?: boolean
}

export default function InstanceCard({ instance, onSetupClick, onDeleteClick, isDeleting = false }: InstanceCardProps) {
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
        <Badge variant={getStatusVariant()}>{getStatusLabel()}</Badge>
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
            OpenClaw: <span className="text-terminal-success">{instance.software.openclaw}</span>
          </div>
        </div>
      </div>

      {/* Provisioned At */}
      <div className="text-xs text-gray-500 mb-4">
        Provisioned {new Date(instance.provisionedAt).toLocaleString()}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {instance.status === 'active' && !instance.onboardingCompleted && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onSetupClick(instance.name)}
          >
            <Terminal className="w-4 h-4 mr-2" />
            Setup OpenClaw
          </Button>
        )}

        {instance.status === 'active' && instance.onboardingCompleted && (
          <div className="flex-1 flex items-center gap-2 text-sm text-terminal-success">
            <CheckCircle2 className="w-4 h-4" />
            <span>Ready to use</span>
          </div>
        )}

        {instance.status === 'deleted' && (
          <div className="flex-1 flex items-center gap-2 text-sm text-terminal-error">
            <AlertCircle className="w-4 h-4" />
            <span>Instance deleted</span>
          </div>
        )}

        {instance.status === 'active' && (
          <>
            <button
              onClick={() => copyToClipboard(sshCommand)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-sm flex items-center gap-2"
              title="Copy SSH command"
            >
              <Copy className="w-4 h-4" />
              SSH
            </button>
            <button
              onClick={() => onDeleteClick(instance.name)}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 hover:text-red-300 rounded-lg transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete instance"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
