'use client'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-white/10 bg-background/80 backdrop-blur-lg mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent-purple to-accent-blue mb-2">
              RoboClaw
            </h3>
            <p className="text-sm text-gray-400 mb-2">
              Open-source AI agent deployment platform
            </p>
            <p className="text-sm text-gray-400">
              Built for and by the OpenClaw community
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/hintjen/roboclaw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://discord.gg/8DaPXhRFfv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                >
                  Community
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Support</h4>
            <ul className="space-y-2">
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  Contact Us
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  Report Issue
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-400 hover:text-accent-purple transition-colors"
                  onClick={(e) => e.preventDefault()}
                >
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col items-center md:items-start gap-2">
              <p className="text-sm text-gray-500">
                © {currentYear} RoboClaw. All rights reserved.
              </p>
              <p className="text-xs text-gray-600">
                This project is not officially affiliated with the OpenClaw project.
              </p>
            </div>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
                onClick={(e) => e.preventDefault()}
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
