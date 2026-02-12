'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { navItems, isActivePath } from '@/lib/navItems'

export function BottomNav() {
  const pathname = usePathname()
  const { isStandalone } = useInstallPrompt()

  // Only show on mobile and when in standalone mode or always on mobile for testing
  // We'll show it on mobile viewports regardless of standalone mode for better UX
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href)

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-4"
              >
                <div className="w-14 h-14 bg-green-600 hover:bg-green-500 rounded-full flex items-center justify-center shadow-lg transition-colors">
                  <span className="text-white">{active ? item.activeIcon : item.icon}</span>
                </div>
              </Link>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] py-2 transition-colors ${
                active
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <span className="mb-0.5">{active ? item.activeIcon : item.icon}</span>
              <span className={`text-xs ${active ? 'font-medium' : ''}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
