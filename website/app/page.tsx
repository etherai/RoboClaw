import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Server, Shield, Cpu, Globe, Zap, Code, MessageCircle, Users, Github, Lock, History, Vault, Eye, FileCheck, Network } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-accent-purple/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-accent-blue/20 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block px-4 py-2 mb-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-gray-300">
              Powered by OpenClaw
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
              Your personal AI, connected to everything you use
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
              RoboClaw brings enterprise-grade security to OpenClaw—cryptographic auditing, time-machine rollback, and vault-native secrets. Deploy community workflows or integrate with your tools in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://github.com/etherai/roboclaw" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="min-w-[200px] flex items-center gap-2">
                  <Github className="w-5 h-5" />
                  View on GitHub
                </Button>
              </a>
              <a href="https://discord.gg/8DaPXhRFfv" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="lg" className="min-w-[200px] flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Join Discord
                </Button>
              </a>
            </div>

            {/* Terminal Mockup */}
            <div className="mt-16 max-w-3xl mx-auto">
              <div className="bg-terminal-bg rounded-lg shadow-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-gray-400 ml-2">roboclaw-deploy</span>
                </div>
                <div className="p-4 font-mono text-sm space-y-1">
                  <div className="text-gray-500">[12:34:56]</div>
                  <div className="text-terminal-command">$ Provisioning VPS...</div>
                  <div className="text-terminal-success">✓ Server created (IP: 65.21.149.78)</div>
                  <div className="text-terminal-command">$ Installing Docker CE...</div>
                  <div className="text-terminal-success">✓ Docker installed</div>
                  <div className="text-terminal-command">$ Installing RoboClaw...</div>
                  <div className="text-terminal-success">✓ Deployment completed in 127s</div>
                  <div className="text-white mt-2 animate-pulse">▊</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-24">
            <ValuePropCard
              icon={<Zap className="w-10 h-10" />}
              title="Fast"
              subtitle="Community Workflows"
              description="Deploy battle-tested OpenClaw configurations in one command. Every workflow leverages OpenClaw's native multi-agent routing and tool execution."
              badge="Powered by OpenClaw's skill system"
            />
            <ValuePropCard
              icon={<Lock className="w-10 h-10" />}
              title="Secure"
              subtitle="Vault-Native Secrets"
              description="Your API keys never leave your infrastructure. Built-in secret storage, access proxy, and zero-trust architecture. Extends OpenClaw's security model."
              badge="SOC2-ready audit logs"
            />
            <ValuePropCard
              icon={<History className="w-10 h-10" />}
              title="Reversible"
              subtitle="Time-Machine Rollback"
              description="BTRFS snapshots every OpenClaw configuration change. Rollback any mistake instantly. Cryptographic proof of every action your AI took."
              badge="Integrates with OpenClaw gateway"
            />
          </div>

          <h2 className="text-4xl font-bold text-center mb-16">Enterprise Security for OpenClaw</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<FileCheck className="w-8 h-8" />}
              title="Cryptographic Auditing"
              description="Every OpenClaw action logged and signed. Immutable audit trail for compliance."
            />
            <FeatureCard
              icon={<History className="w-8 h-8" />}
              title="BTRFS Snapshots"
              description="Time-machine for OpenClaw deployments. Restore to any point in history."
            />
            <FeatureCard
              icon={<Vault className="w-8 h-8" />}
              title="Secret Vault"
              description="Encrypted credential storage for OpenClaw skills. Decrypted only in memory."
            />
            <FeatureCard
              icon={<Network className="w-8 h-8" />}
              title="Access Proxy"
              description="Zero-trust layer for OpenClaw tool execution. Every API call authenticated."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Workflow Verification"
              description="Community OpenClaw configs cryptographically signed. Verify before deploy."
            />
            <FeatureCard
              icon={<Eye className="w-8 h-8" />}
              title="Transparent Reasoning"
              description="OpenClaw's AI thinking, visible. See confidence scores and decision rationale."
            />
          </div>
        </div>
      </section>

      {/* Workflow Marketplace Section */}
      <section className="py-24 relative bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Community OpenClaw Workflows</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Deploy verified OpenClaw configurations curated by the community. Every workflow is cryptographically signed and audited.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-8">
            <WorkflowCard
              icon="🔥"
              title="AI Code Review Assistant"
              author="@anthropic-community"
              deploys="4,823"
              description="Uses OpenClaw's tool execution to review PRs, suggest fixes, and catch bugs"
              integrations={["GitHub", "Linear", "Slack"]}
              security={["GitHub token in vault", "Cryptographic audit of PR comments", "Rollback any config change"]}
            />
            <WorkflowCard
              icon="⭐"
              title="Customer Support Agent"
              author="@zendesk-ai"
              deploys="3,291"
              description="Uses OpenClaw's multi-channel gateway to respond via Slack and search Zendesk"
              integrations={["Slack", "Zendesk", "Knowledge Base"]}
              security={["Slack/Zendesk tokens in vault", "Access proxy for API calls", "Audit log of interactions"]}
            />
          </div>

          <div className="text-center">
            <a href="https://github.com/etherai/roboclaw#workflows" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="lg">
                Browse All Workflows →
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Discord Community Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-[#5865F2]/10 to-[#5865F2]/5 backdrop-blur-lg border border-[#5865F2]/20 rounded-2xl p-12 text-center relative overflow-hidden">
              {/* Discord-themed gradient orb */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#5865F2]/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-[#5865F2]/10 rounded-full blur-3xl"></div>

              <div className="relative z-10">
                <div className="flex justify-center mb-6">
                  <div className="w-16 h-16 bg-[#5865F2] rounded-full flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold mb-4">Join the Community</h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  Get help, share tips, and connect with other RoboClaw users in our Discord server
                </p>
                <a href="https://discord.gg/8DaPXhRFfv" target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="bg-[#5865F2] hover:bg-[#4752C4] text-white min-w-[200px] flex items-center gap-2 mx-auto">
                    <MessageCircle className="w-5 h-5" />
                    Join Discord
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-6">How It Works</h2>
          <p className="text-center text-gray-400 mb-16 max-w-2xl mx-auto">
            Deploy production-ready OpenClaw with enterprise security in three steps
          </p>
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Deploy OpenClaw"
              description="One command deploys OpenClaw with BTRFS snapshots, cryptographic auditing, and secret vault—all configured and ready"
            />
            <StepCard
              number={2}
              title="Choose Integration"
              description="Deploy a community workflow (Slack bot, GitHub integration) or connect your own tools using OpenClaw's skill system"
            />
            <StepCard
              number={3}
              title="Monitor & Rollback"
              description="Watch OpenClaw's AI reasoning in real-time. RoboClaw snapshots every change—rollback anytime with one click"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-gray-400 mb-12">Pay only for your infrastructure. RoboClaw and OpenClaw are free and open source.</p>

          <div className="max-w-md mx-auto">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 text-center">
              <div className="inline-block px-3 py-1 bg-accent-purple/20 border border-accent-purple/30 rounded-full text-xs text-accent-purple mb-4">
                Recommended Configuration
              </div>
              <h3 className="text-3xl font-bold mb-2">€3.29/month</h3>
              <p className="text-sm text-gray-400 mb-6">Hetzner Cloud CAX11</p>
              <div className="space-y-2 text-gray-400 mb-6 pb-6 border-b border-white/10">
                <p>2 vCPU (ARM64)</p>
                <p>4GB RAM</p>
                <p>40GB SSD (BTRFS)</p>
                <p>20TB Bandwidth</p>
              </div>
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <p className="flex items-center justify-center gap-2">
                  <span className="text-accent-purple">✓</span>
                  OpenClaw pre-installed
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="text-accent-purple">✓</span>
                  Cryptographic auditing enabled
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="text-accent-purple">✓</span>
                  Time-machine snapshots ready
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="text-accent-purple">✓</span>
                  Secret vault configured
                </p>
              </div>
              <p className="text-xs text-gray-500 mb-6">Direct Hetzner pricing. Zero markup.</p>
              <a href="https://github.com/etherai/roboclaw" target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full">Get Started on GitHub</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p className="mb-2">Made with Love with <a href="https://github.com/etherai/openclaw" target="_blank" rel="noopener noreferrer" className="text-accent-purple hover:text-accent-blue transition-colors">OpenClaw</a></p>
          <p className="text-gray-600">Built with Next.js. Servers powered by Hetzner Cloud.</p>
        </div>
      </footer>
    </main>
  )
}

function ValuePropCard({ icon, title, subtitle, description, badge }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-accent-purple/50 transition-all">
      <div className="text-accent-purple mb-6">{icon}</div>
      <div className="mb-4">
        <div className="text-sm font-semibold text-accent-blue mb-1">{title}</div>
        <h3 className="text-2xl font-bold mb-3">{subtitle}</h3>
      </div>
      <p className="text-gray-400 mb-4 leading-relaxed">{description}</p>
      <div className="inline-block px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-400">
        {badge}
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 hover:border-accent-purple/50 transition-all">
      <div className="text-accent-purple mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}

function WorkflowCard({
  icon,
  title,
  author,
  deploys,
  description,
  integrations,
  security
}: {
  icon: string;
  title: string;
  author: string;
  deploys: string;
  description: string;
  integrations: string[];
  security: string[];
}) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:border-accent-purple/50 transition-all">
      <div className="flex items-start gap-4 mb-4">
        <div className="text-4xl">{icon}</div>
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-1">{title}</h3>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{author}</span>
            <span>•</span>
            <span>{deploys} deploys</span>
          </div>
        </div>
      </div>

      <p className="text-gray-400 mb-4 text-sm leading-relaxed">{description}</p>

      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">Integrates:</div>
        <div className="flex flex-wrap gap-2">
          {integrations.map((integration) => (
            <span key={integration} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300">
              {integration}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10">
        <div className="text-xs font-semibold text-accent-purple mb-2">🔒 Secured by RoboClaw:</div>
        <ul className="space-y-1">
          {security.map((item, index) => (
            <li key={index} className="text-xs text-gray-400 flex items-start">
              <span className="text-accent-purple mr-2">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 flex gap-3">
        <button className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors">
          View Config
        </button>
        <button className="flex-1 px-4 py-2 bg-gradient-to-r from-accent-purple to-accent-blue hover:opacity-90 rounded-lg text-sm font-medium transition-opacity">
          Deploy →
        </button>
      </div>
    </div>
  )
}

function StepCard({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-accent-purple to-accent-blue flex items-center justify-center text-xl font-bold">
          {number}
        </div>
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}
