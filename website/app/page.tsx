'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import { Server, Shield, Cpu, Globe, Zap, Code, MessageCircle, Users, Github, Lock, History, Vault, Eye, FileCheck, Network } from 'lucide-react'
import React, { useState, useEffect } from 'react'

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
              Powered by ClawFleet and OpenClaw
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-gray-400">
              Launch OpenClaw Without Getting Pinched
            </h1>
            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
              Deploy your own OpenClaw in minutes. Free, secure, and fully reversible.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://github.com/hintjen/roboclaw" target="_blank" rel="noopener noreferrer">
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

            {/* Terminal Mockup with Tabs */}
            <TabbedTerminal />
          </div>
        </div>
      </section>

      {/* Get Started CTAs */}
      <section className="py-24 relative bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">Get Started</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Primary CTA */}
            <div className="bg-gradient-to-br from-accent-purple/10 to-accent-blue/10 backdrop-blur-lg border border-accent-purple/30 rounded-2xl p-8 relative overflow-hidden hover:border-accent-purple/50 transition-all">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-accent-purple/20 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-6 h-6 text-accent-purple" />
                  <span className="text-xs font-semibold text-accent-purple uppercase tracking-wider">Recommended</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">Deploy OpenClaw to Your VPS via SSH</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Bring your own server and get full control. RoboClaw deploys OpenClaw to any VPS using SSH and Ansible—just provide your server credentials and we'll handle the installation, configuration, and setup automatically. Works with any cloud provider: AWS, DigitalOcean, Linode, Hetzner, or even your home server.
                </p>
                <a href="https://github.com/hintjen/roboclaw" target="_blank" rel="noopener noreferrer">
                  <Button className="w-full mb-4 flex items-center justify-center gap-2">
                    <Github className="w-5 h-5" />
                    Deploy via SSH →
                  </Button>
                </a>
                <div className="text-sm text-gray-500 space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="text-accent-purple">✓</span>
                    Your data stays on your server
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-accent-purple">✓</span>
                    Your secrets stay on your computer
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-accent-purple">✓</span>
                    No vendor lock-in
                  </p>
                </div>
              </div>
            </div>

            {/* Secondary CTA - Coming Soon */}
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 relative overflow-hidden opacity-75">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-6 h-6 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Coming Soon</span>
                </div>
                <h3 className="text-2xl font-bold mb-3">RoboClaw Cloud</h3>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Want zero infrastructure hassle? Deploy OpenClaw on RoboClaw's managed cloud—no VPS required, no SSH setup, no server maintenance. Just sign up and start building.
                </p>
                <Button variant="secondary" className="w-full" disabled>
                  Coming Soon
                </Button>
                <div className="mt-6 p-3 bg-white/5 border border-white/10 rounded-lg">
                  <p className="text-xs text-gray-400">
                    Join our <a href="https://discord.gg/8DaPXhRFfv" target="_blank" rel="noopener noreferrer" className="text-accent-purple hover:text-accent-blue transition-colors">Discord</a> to be notified when RoboClaw Cloud launches
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Four Pillars Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto mb-24">
            <ValuePropCard
              icon={<Zap className="w-10 h-10" />}
              title="Fast"
              subtitle="Ready-to-Use Templates"
              description="Get started instantly with pre-configured OpenClaw setups from the community. Deploy popular use cases with one command."
              badge="Powered by OpenClaw's skill system"
            />
            <ValuePropCard
              icon={<Shield className="w-10 h-10" />}
              title="Always Updated"
              subtitle="Automatic Security Patches"
              description="RoboClaw keeps your OpenClaw deployment secure with automatic updates and security patches. Never worry about vulnerabilities or falling behind—your instance stays current without any manual intervention."
              badge="Set it and forget it"
            />
            <ValuePropCard
              icon={<Lock className="w-10 h-10" />}
              title="Secure"
              subtitle="Your Secrets Never Leave Your Computer"
              description="Your passwords and API keys stay on your local computer. RoboClaw Companion Desktop (coming soon) provides a secure API proxy and audit layer that keeps you safe and in control."
              badge="Enterprise-grade protection"
            />
            <ValuePropCard
              icon={<History className="w-10 h-10" />}
              title="Reversible"
              subtitle="Experiment Safely"
              description="Try anything without worry! Made a mistake? Roll back to a working state with one click. See exactly what your AI agents did and when."
              badge="Time-travel for your AI agents"
            />
          </div>

          <h2 className="text-4xl font-bold text-center mb-16">Safety & Control Features</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<FileCheck className="w-8 h-8" />}
              title="Complete Activity Log"
              description="See everything your AI agents do, every single action recorded and timestamped. Perfect for keeping track of what happened."
            />
            <FeatureCard
              icon={<History className="w-8 h-8" />}
              title="Safe Experimentation"
              description="Try new things without worry! Your AI agents' setup is automatically saved, so you can always get back to a working state. Experiment freely and roll back anytime."
            />
            <FeatureCard
              icon={<Vault className="w-8 h-8" />}
              title="Protected Passwords"
              description="Your sensitive information is encrypted and stored safely. Your credentials never touch the internet unprotected."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Automatic Security Updates"
              description="RoboClaw continuously monitors and applies security patches to your OpenClaw instance. Stay protected against vulnerabilities without lifting a finger."
            />
            <FeatureCard
              icon={<Network className="w-8 h-8" />}
              title="Secure Connection Layer"
              description="Every action your AI agents take goes through a protective layer that keeps the bad guys out."
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Verified Templates"
              description="Community templates are checked and verified before you can use them. Know exactly what you're installing."
            />
            <FeatureCard
              icon={<Eye className="w-8 h-8" />}
              title="See Your AI Agents Think"
              description="Watch your AI agents' thought process in real-time. Understand why they make each decision."
            />
          </div>
        </div>
      </section>

      {/* Workflow Marketplace Section */}
      <section className="py-24 relative bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Community Marketplace</h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Browse workflows, plugins, and skills curated by the OpenClaw community. Everything is tested, verified, and ready to use. Just pick what you need from the marketplace and start using it right away.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-8">
            <WorkflowCard
              icon="🔥"
              title="AI Code Review Assistant"
              author="@anthropic-community"
              deploys="4,823"
              description="Automatically reviews your code, suggests improvements, and catches bugs before they become problems"
              integrations={["GitHub", "Linear", "Slack"]}
              security={["Secure password storage", "Full activity history", "Easy rollback"]}
            />
            <WorkflowCard
              icon="⭐"
              title="Customer Support Agent"
              author="@zendesk-ai"
              deploys="3,291"
              description="Responds to customer questions on Slack and finds answers in your knowledge base"
              integrations={["Slack", "Zendesk", "Knowledge Base"]}
              security={["Tokens stored safely", "Protected connections", "Complete interaction log"]}
            />
          </div>

          <div className="text-center">
            <a href="https://github.com/hintjen/roboclaw#workflows" target="_blank" rel="noopener noreferrer">
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
            Get your personal OpenClaw instance up and running in three simple steps
          </p>
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
            <StepCard
              number={1}
              title="Deploy Your Personal OpenClaw"
              description="One simple command deploys your own OpenClaw instance—automatic backups, activity logging, and secure password storage all configured and ready"
            />
            <StepCard
              number={2}
              title="Browse the Marketplace"
              description="Explore workflows, plugins, and skills curated by the OpenClaw community. Pick what you need from the marketplace—whether it's a Slack bot, GitHub helper, or custom automation"
            />
            <StepCard
              number={3}
              title="Stay in Control"
              description="Watch what your AI agents are thinking in real-time. Everything gets saved automatically—experiment freely and undo any mistake with one click"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p className="mb-2">RoboClaw: Powered by <span className="text-accent-blue">ClawFleet</span> and <a href="https://github.com/etherai/openclaw" target="_blank" rel="noopener noreferrer" className="text-accent-purple hover:text-accent-blue transition-colors">OpenClaw</a>. Deploying OpenClaw since 2026.</p>
          <p className="text-gray-600">Made with Love by <a href="https://github.com/hintjen" target="_blank" rel="noopener noreferrer" className="text-accent-purple hover:text-accent-blue transition-colors">Hintjen</a>.</p>
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

function TabbedTerminal() {
  const [activeTab, setActiveTab] = useState<'cli' | 'ui'>('ui')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [typedHost, setTypedHost] = useState('')
  const [typedUser, setTypedUser] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [deploymentStep, setDeploymentStep] = useState(0)

  // Auto-progress slides
  useEffect(() => {
    if (activeTab !== 'ui') return

    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % 4)
      // Reset animations when looping back
      if (currentSlide === 3) {
        setTypedHost('')
        setTypedUser('')
        setShowKey(false)
        setDeploymentStep(0)
      }
    }, currentSlide === 1 ? 5000 : 4000) // Longer duration for deployment slide

    return () => clearTimeout(timer)
  }, [currentSlide, activeTab])

  // Simulate typing for slide 1
  useEffect(() => {
    if (currentSlide !== 0 || activeTab !== 'ui') return

    const hostText = '65.21.149.78'
    const userText = 'root'

    // Type host
    const hostTimer = setTimeout(() => {
      if (typedHost.length < hostText.length) {
        setTypedHost(hostText.slice(0, typedHost.length + 1))
      } else if (typedUser.length < userText.length) {
        setTypedUser(userText.slice(0, typedUser.length + 1))
      } else if (!showKey) {
        setShowKey(true)
      }
    }, 100)

    return () => clearTimeout(hostTimer)
  }, [currentSlide, typedHost, typedUser, showKey, activeTab])

  // Animate deployment steps for slide 2
  useEffect(() => {
    if (currentSlide !== 1 || activeTab !== 'ui') return

    const timer = setTimeout(() => {
      if (deploymentStep < 4) {
        setDeploymentStep(deploymentStep + 1)
      }
    }, 1000) // Each step takes 1 second

    return () => clearTimeout(timer)
  }, [currentSlide, deploymentStep, activeTab])

  const slides = [
    {
      title: 'Enter SSH Credentials',
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">SSH Host</label>
            <div className="relative">
              <input
                type="text"
                value={typedHost}
                readOnly
                className="w-full px-4 py-2 bg-white/5 border border-accent-purple/50 rounded-lg text-white focus:outline-none"
              />
              {typedHost.length > 0 && typedHost.length < 13 && (
                <span className="absolute right-4 top-2 animate-pulse text-white">|</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
            <div className="relative">
              <input
                type="text"
                value={typedUser}
                readOnly
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none"
                style={{ borderColor: typedHost.length === 13 ? 'rgb(168, 85, 247, 0.5)' : 'rgb(255, 255, 255, 0.2)' }}
              />
              {typedHost.length === 13 && typedUser.length > 0 && typedUser.length < 4 && (
                <span className="absolute right-4 top-2 animate-pulse text-white">|</span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Authentication</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="px-4 py-2 bg-accent-purple/20 border border-accent-purple rounded-lg text-sm text-accent-purple">
                  SSH Key
                </div>
                <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-gray-400">
                  Password
                </div>
              </div>
              {showKey && (
                <div className="animate-fade-in">
                  <textarea
                    value="-----BEGIN OPENSSH PRIVATE KEY-----&#10;b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAG..."
                    readOnly
                    rows={3}
                    className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-gray-400 text-xs font-mono focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Deploying OpenClaw',
      content: (
        <div className="space-y-6 py-8">
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold text-white mb-2">Deploying to your server</h3>
            <p className="text-sm text-gray-400">This will take a few moments...</p>
          </div>
          <div className="space-y-4 max-w-md mx-auto">
            {[
              { label: 'Verify host connectivity', step: 1 },
              { label: 'Provisioning OpenClaw', step: 2 },
              { label: 'Verifying OpenClaw deployment', step: 3 },
              { label: 'Done', step: 4 }
            ].map((item) => (
              <div
                key={item.step}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  deploymentStep >= item.step
                    ? 'bg-white/5 border-accent-purple/30'
                    : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  deploymentStep >= item.step
                    ? 'bg-accent-purple'
                    : 'bg-white/10'
                }`}>
                  {deploymentStep >= item.step ? (
                    <svg className="w-4 h-4 text-white animate-scale-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 bg-white/30 rounded-full"></div>
                  )}
                </div>
                <span className={`text-sm transition-colors ${
                  deploymentStep >= item.step ? 'text-white' : 'text-gray-500'
                }`}>
                  {item.label}
                </span>
                {deploymentStep === item.step && deploymentStep < 4 && (
                  <div className="ml-auto flex gap-1">
                    <div className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-accent-purple rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: 'Connect Integrations',
      content: (
        <div className="space-y-6 animate-fade-in">
          {/* Provider Tabs */}
          <div className="flex items-center justify-center gap-2 pb-4 border-b border-white/10">
            <div className="flex gap-2 flex-wrap justify-center">
              <div className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-500 rounded-lg text-sm font-medium text-green-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                WhatsApp
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-gray-500">
                Matrix
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-gray-500">
                Discord
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-gray-500">
                Slack
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-sm text-gray-500">
                Telegram
              </div>
            </div>
          </div>

          {/* WhatsApp QR Code Content */}
          <div className="text-center">
            <div className="inline-block p-6 bg-white rounded-lg shadow-lg">
              <div className="w-48 h-48 bg-black flex items-center justify-center">
                <div className="grid grid-cols-3 gap-1 animate-pulse">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="w-3 h-3 bg-white rounded-sm"></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2 mt-6">
              <h3 className="text-lg font-semibold text-white">Scan QR Code with WhatsApp</h3>
              <p className="text-sm text-gray-400">Open WhatsApp on your phone and scan this code</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm mt-4">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-gray-400">Connecting...</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Success!',
      content: (
        <div className="space-y-6 text-center py-8 animate-fade-in">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
              <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">OpenClaw Deployed!</h3>
            <p className="text-gray-400">Your personal AI agent platform is ready</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-gray-400">Dashboard:</span>
              <span className="text-accent-blue font-mono">https://65.21.149.78:3000</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-green-500">
              <span>✓</span>
              WhatsApp Connected
            </div>
            <div className="pt-3 border-t border-white/10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-purple/20 to-accent-blue/20 border border-accent-purple/30 rounded-lg text-sm text-accent-purple">
                <span>→</span>
                Configure my OpenClaw
              </div>
            </div>
          </div>
        </div>
      )
    }
  ]

  return (
    <div className="mt-16 max-w-3xl mx-auto">
      <div className="bg-terminal-bg rounded-lg shadow-2xl border border-white/10 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setActiveTab('ui')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'ui'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              RoboClaw UI
            </button>
            <button
              onClick={() => setActiveTab('cli')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                activeTab === 'cli'
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              CLI Deploy
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {activeTab === 'cli' ? (
            <div className="font-mono text-sm space-y-1">
              <div className="text-gray-500">[12:34:56]</div>
              <div className="text-terminal-command">$ roboclaw deploy --ssh user@65.21.149.78</div>
              <div className="text-terminal-success">✓ Connected via SSH</div>
              <div className="text-terminal-command">$ Running Ansible playbook...</div>
              <div className="text-terminal-success">✓ OpenClaw installed</div>
              <div className="text-terminal-success">✓ RoboClaw features configured</div>
              <div className="text-terminal-success">✓ Your personal OpenClaw is ready!</div>
              <div className="text-white mt-2">🎉 Dashboard: https://65.21.149.78:3000</div>
              <div className="text-white mt-2 animate-pulse">▊</div>
            </div>
          ) : (
            <div className="min-h-[400px]">
              {slides[currentSlide].content}

              {/* Carousel Indicators */}
              <div className="flex items-center justify-center gap-2 mt-8">
                {slides.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 rounded-full transition-all ${
                      currentSlide === index
                        ? 'w-8 bg-accent-purple'
                        : 'w-2 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
