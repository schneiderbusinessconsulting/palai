'use client'

import { Star } from 'lucide-react'

const STAR_CYCLE: (string | null)[] = [null, 'yellow', 'red', 'blue', 'green', 'purple']

const STAR_COLORS: Record<string, string> = {
  yellow: 'text-yellow-500 fill-yellow-500',
  red: 'text-red-500 fill-red-500',
  blue: 'text-blue-500 fill-blue-500',
  green: 'text-green-500 fill-green-500',
  purple: 'text-purple-500 fill-purple-500',
}

const SIZE_MAP = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
}

interface StarPickerProps {
  starType: string | null | undefined
  onStarChange: (starType: string | null) => void
  size?: 'sm' | 'md'
}

export function StarPicker({ starType, onStarChange, size = 'sm' }: StarPickerProps) {
  const current = starType ?? null
  const currentIndex = STAR_CYCLE.indexOf(current)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    const nextIndex = (currentIndex === -1 ? 1 : currentIndex + 1) % STAR_CYCLE.length
    onStarChange(STAR_CYCLE[nextIndex])
  }

  const colorClass = current && STAR_COLORS[current]
    ? STAR_COLORS[current]
    : 'text-gray-400'

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded p-0.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={current ? `Starred ${current}` : 'Not starred'}
    >
      <Star className={`${SIZE_MAP[size]} ${colorClass}`} />
    </button>
  )
}
