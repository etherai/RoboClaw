import { useState, useCallback } from 'react'
import type {
  DeployConfig,
  LogEntry,
  PhaseUpdate,
  DeployResult,
  DeployError,
} from '@/lib/types'

interface DeploymentStreamState {
  logs: LogEntry[]
  phase: PhaseUpdate | null
  progress: number
  result: DeployResult | null
  error: DeployError | null
  isDeploying: boolean
}

export function useDeploymentStream() {
  const [state, setState] = useState<DeploymentStreamState>({
    logs: [],
    phase: null,
    progress: 0,
    result: null,
    error: null,
    isDeploying: false,
  })

  const startDeploy = useCallback(async (config: DeployConfig) => {
    // Reset state
    setState({
      logs: [],
      phase: null,
      progress: 0,
      result: null,
      error: null,
      isDeploying: true,
    })

    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start deployment')
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        let currentEvent = ''
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.substring(6).trim()
          } else if (line.startsWith('data:')) {
            currentData = line.substring(5).trim()
          } else if (line === '') {
            // Empty line signals end of event
            if (currentEvent && currentData) {
              handleEvent(currentEvent, currentData)
              currentEvent = ''
              currentData = ''
            }
          }
        }
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: false,
        },
        isDeploying: false,
      }))
    }
  }, [])

  const handleEvent = (event: string, data: string) => {
    try {
      const parsedData = JSON.parse(data)

      switch (event) {
        case 'log':
          setState((prev) => ({
            ...prev,
            logs: [...prev.logs, parsedData as LogEntry],
          }))
          break

        case 'phase':
          setState((prev) => ({
            ...prev,
            phase: parsedData as PhaseUpdate,
          }))
          break

        case 'progress':
          setState((prev) => ({
            ...prev,
            progress: parsedData.percent,
          }))
          break

        case 'success':
          setState((prev) => ({
            ...prev,
            result: parsedData as DeployResult,
            isDeploying: false,
          }))
          break

        case 'error':
          setState((prev) => ({
            ...prev,
            error: parsedData as DeployError,
            isDeploying: false,
          }))
          break

        case 'heartbeat':
          // Ignore heartbeat events
          break

        default:
          console.warn('Unknown SSE event:', event)
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error)
    }
  }

  const reset = useCallback(() => {
    setState({
      logs: [],
      phase: null,
      progress: 0,
      result: null,
      error: null,
      isDeploying: false,
    })
  }, [])

  return {
    ...state,
    startDeploy,
    reset,
  }
}
