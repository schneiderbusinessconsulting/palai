'use client'

import { AlignJustify, LayoutList, StretchHorizontal } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type Density = 'compact' | 'default' | 'comfortable'

interface DensityToggleProps {
  density: Density
  onDensityChange: (density: Density) => void
}

const options: { value: Density; label: string; icon: React.ElementType }[] = [
  { value: 'compact', label: 'Kompakt', icon: AlignJustify },
  { value: 'default', label: 'Standard', icon: LayoutList },
  { value: 'comfortable', label: 'Komfortabel', icon: StretchHorizontal },
]

export function DensityToggle({ density, onDensityChange }: DensityToggleProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="inline-flex items-center rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        {options.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onDensityChange(value)}
                className={`inline-flex items-center justify-center p-1.5 transition-colors ${
                  density === value
                    ? 'bg-gold-500 text-white'
                    : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                } first:rounded-l-md last:rounded-r-md`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  )
}
