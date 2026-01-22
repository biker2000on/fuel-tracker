'use client'

interface PendingFillupBadgeProps {
  className?: string
}

/**
 * Badge component indicating a fillup is pending sync
 * Shows amber/yellow color with clock icon to indicate waiting state
 */
export function PendingFillupBadge({ className = '' }: PendingFillupBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 ${className}`}
    >
      {/* Clock icon */}
      <svg
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Pending
    </span>
  )
}
