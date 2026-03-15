'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { label: 'Alle', value: '' },
  { label: 'Anfragen', value: 'Anfrage' },
  { label: 'Bestellungen', value: 'Bestellung' },
  { label: 'Feedback', value: 'Feedback' },
  { label: 'Beschwerden', value: 'Beschwerde' },
  { label: 'Kurs', value: 'Kurs' },
  { label: 'Zertifikat', value: 'Zertifikat' },
] as const

interface CategoryTabsProps {
  selectedCategory: string
  onCategoryChange: (category: string) => void
  emailCounts?: Record<string, number>
}

export function CategoryTabs({
  selectedCategory,
  onCategoryChange,
  emailCounts,
}: CategoryTabsProps) {
  const totalCount = emailCounts
    ? Object.values(emailCounts).reduce((sum, count) => sum + count, 0)
    : undefined

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {CATEGORIES.map(({ label, value }) => {
        const isActive = selectedCategory === value
        const count =
          value === ''
            ? totalCount
            : emailCounts?.[value]

        return (
          <button
            key={value}
            onClick={() => onCategoryChange(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
              'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {label}
            {count !== undefined && count > 0 && (
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="ml-0.5 px-1.5 py-0 text-[10px] leading-4"
              >
                {count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
