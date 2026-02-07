#!/usr/bin/env node

/**
 * clawctl - CLI tool for deploying and managing OpenClaw instances
 */

import { Command } from 'commander'
import { deployCommand } from './commands/deploy.js'

const program = new Command()

program
  .name('clawctl')
  .description('CLI tool for deploying and managing OpenClaw instances via Docker')
  .version('1.0.1')

// Deploy command
program
  .command('deploy')
  .description('Deploy OpenClaw to a remote server')
  .argument('<ip>', 'Target server IP address')
  .requiredOption('-k, --key <path>', 'SSH private key path')
  .option('-n, --name <name>', 'Instance name (default: instance-<IP-dashed>)')
  .option('-u, --user <user>', 'SSH username (must be root)', 'root')
  .option('-p, --port <port>', 'SSH port', '22')
  .option('-b, --branch <branch>', 'OpenClaw git branch', 'main')
  .option('--skip-onboard', 'Skip onboarding wizard', false)
  .option('--no-auto-connect', 'Skip auto-connect to dashboard')
  .option('-g, --global', 'Save artifact to ~/.clawctl/instances/', false)
  .option('-f, --force', 'Ignore partial deployment state', false)
  .option('--clean', 'Remove everything and start fresh', false)
  .option('-v, --verbose', 'Verbose output', false)
  .action(async (ip, options) => {
    await deployCommand({ ip, ...options })
  })

// Parse arguments
program.parse()
