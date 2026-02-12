'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { navItems, isActivePath } from '@/lib/navItems'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 z-40">
      <div className="px-6 py-5">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Fuel Tracker</h1>
      </div>
      <div className="flex flex-col gap-1 mt-2">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 gap-3 rounded-lg mx-2 text-sm transition-colors ${
                active
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="w-5 h-5 flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5">
                {active ? item.activeIcon : item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
