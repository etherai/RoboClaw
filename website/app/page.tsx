import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Server, Shield, Cpu, Globe, Zap, Code, MessageCircle, Users } from 'lucide-react'

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
            <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
              Deploy OpenClaw in 2 Minutes
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Automated VPS provisioning with OpenClaw, Docker, and all dependencies. Just paste your Hetzner API token and launch.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/deploy">
                <Button size="lg" className="min-w-[200px]">
                  Launch Instance
                </Button>
              </Link>
              <a href="https://discord.gg/6ccxYf3c6q" target="_blank" rel="noopener noreferrer">
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

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">What Gets Installed</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<Server className="w-8 h-8" />}
              title="Docker CE"
              description="Latest Docker Engine with containerd runtime"
            />
            <FeatureCard
              icon={<Code className="w-8 h-8" />}
              title="Node.js 22"
              description="LTS release with pnpm package manager"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="UFW Firewall"
              description="Deny all incoming, allow SSH only"
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="RoboClaw"
              description="Pre-installed and ready to onboard"
            />
            <FeatureCard
              icon={<Cpu className="w-8 h-8" />}
              title="ARM64 Instance"
              description="33% cheaper than x86 alternatives"
            />
            <FeatureCard
              icon={<Globe className="w-8 h-8" />}
              title="Helsinki DC"
              description="EU-based, low latency, privacy-friendly"
            />
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
                <a href="https://discord.gg/6ccxYf3c6q" target="_blank" rel="noopener noreferrer">
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
          <h2 className="text-4xl font-bold text-center mb-16">How It Works</h2>
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Get Your Token"
              description="Create a Hetzner API token with Read & Write permissions"
            />
            <StepCard
              number={2}
              title="Click Launch"
              description="Paste your token and watch the deployment happen in real-time"
            />
            <StepCard
              number={3}
              title="SSH In & Go"
              description="Download the SSH key, connect to your server, and onboard RoboClaw"
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 text-center">
              <h3 className="text-3xl font-bold mb-4">EUR 3.29/month</h3>
              <div className="space-y-2 text-gray-400 mb-6">
                <p>2 vCPU (ARM64)</p>
                <p>4GB RAM</p>
                <p>40GB SSD</p>
                <p>20TB Bandwidth</p>
              </div>
              <p className="text-sm text-gray-500">Direct Hetzner pricing. Zero markup.</p>
              <Link href="/deploy" className="block mt-6">
                <Button className="w-full">Deploy Now</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Built with Next.js. Servers powered by Hetzner Cloud.</p>
        </div>
      </footer>
    </main>
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
