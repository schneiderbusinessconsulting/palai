'use client'

interface ProgressBarProps {
  /** Progress value 0-100. If undefined, shows indeterminate animation */
  value?: number
  label?: string
  className?: string
}

export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const isIndeterminate = value === undefined

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          {!isIndeterminate && (
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{Math.round(value)}%</span>
          )}
        </div>
      )}
      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        {isIndeterminate ? (
          <div className="h-full w-1/3 bg-blue-500 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" />
        ) : (
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        )}
      </div>
    </div>
  )
}
