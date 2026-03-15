# Whyros Dashboard - Design Briefing

**Für:** Neues Projekt mit gleichem Design
**Tech Stack:** Next.js 14 (App Router) + Tailwind CSS + Supabase

---

## Design System Übersicht

### Farben

```css
/* Primary Brand */
--brand-gold: #B9965A;      /* Logo, Akzente */

/* UI Colors */
--primary: #B9965A;         /* Palacios Gold - Buttons, Active States */
--success: #22C55E;         /* Green-500 */
--warning: #F59E0B;         /* Amber-500 */
--error: #EF4444;           /* Red-500 */

/* Status Colors */
--status-lead: #64748B;     /* Slate-500 */
--status-mql: #B9965A;      /* Gold-500 */
--status-sql: #8B5CF6;      /* Purple-500 */
--status-customer: #22C55E; /* Green-500 */
--status-churned: #EF4444;  /* Red-500 */

/* Backgrounds */
--bg-light: #FFFFFF;
--bg-dark: #0F172A;         /* Slate-900 */
--card-light: #FFFFFF;
--card-dark: #1E293B;       /* Slate-800 */

/* Borders */
--border-light: #E2E8F0;    /* Slate-200 */
--border-dark: #334155;     /* Slate-700 */
```

### Typography

- **Font:** System fonts (Tailwind default)
- **Logo Font:** Georgia, Times, serif
- **Headings:** `font-bold`
- **Body:** `font-normal`

### Spacing

- Page padding: `p-6` (24px)
- Card padding: `p-4` bis `p-6`
- Gap zwischen Sections: `space-y-6` oder `space-y-8`
- Grid gaps: `gap-4` oder `gap-6`

### Border Radius

- Cards: `rounded-xl` (12px)
- Buttons: `rounded-lg` (8px)
- Badges: `rounded-full` oder `rounded`
- Inputs: `rounded-lg`

---

## Dateien zum Kopieren

### 1. Tailwind Config

```
apps/dashboard/tailwind.config.ts
```

### 2. Global Styles

```
apps/dashboard/src/app/globals.css
```

### 3. Core Components

| Datei | Beschreibung |
|-------|--------------|
| `src/components/Sidebar/index.tsx` | Sidebar mit Dark Mode Toggle |
| `src/components/ThemeProvider.tsx` | Dark Mode Context |
| `src/components/FilterBar.tsx` | Reusable Filter Dropdowns |
| `src/components/Cards/StatCard.tsx` | Statistik-Karten |
| `src/components/Charts/ChannelChart.tsx` | Donut Chart |
| `src/components/Charts/TimelineChart.tsx` | Line Chart |

### 4. Layout

```
src/app/layout.tsx
```

---

## Komponenten-Details

### Sidebar

**Features:**
- Collapsible (Desktop)
- Mobile Drawer
- Dark Mode Toggle
- Active State Detection
- BETA Badge

**Key Classes:**
```tsx
// Sidebar Container
"fixed top-0 left-0 z-50 flex h-screen flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"

// Nav Item (inactive)
"flex items-center gap-3 px-4 py-3 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"

// Nav Item (active)
"flex items-center gap-3 px-4 py-3 rounded-lg bg-gold-600 text-white"
```

### Cards

**Stat Card:**
```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
  <p className="text-sm text-slate-500 dark:text-slate-400">Label</p>
  <p className="text-2xl font-bold text-slate-900 dark:text-white">Value</p>
</div>
```

**Content Card:**
```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Title</h3>
  {/* Content */}
</div>
```

### Badges

```tsx
// Status Badge
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
  CUSTOMER
</span>

// Small Badge (BETA)
<span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gold-500 text-white rounded">
  BETA
</span>
```

### Buttons

```tsx
// Primary Button
<button className="px-4 py-2 text-sm font-medium text-white bg-gold-600 hover:bg-gold-700 rounded-lg">
  Action
</button>

// Secondary Button
<button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg">
  Cancel
</button>

// Ghost Button
<button className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
  Skip
</button>
```

### Tables

```tsx
<div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
  <table className="w-full">
    <thead className="bg-slate-50 dark:bg-slate-700/50">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
          Header
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
        <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
          Value
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### Form Inputs

```tsx
// Select
<select className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
  <option>Option</option>
</select>

// Text Input
<input className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400" />
```

---

## Dark Mode Implementation

### ThemeProvider

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const ThemeContext = createContext({
  theme: 'light' as Theme,
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(stored || (prefersDark ? 'dark' : 'light'))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light') }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
```

### Tailwind Config für Dark Mode

```ts
// tailwind.config.ts
export default {
  darkMode: 'class',
  // ...
}
```

---

## Page Layout Pattern

```tsx
export default function Page() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Page Title
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Description
        </p>
      </div>

      {/* Filters (optional) */}
      <FilterBar ... />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard ... />
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card ... />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl ...">
        <table>...</table>
      </div>
    </div>
  )
}
```

---

## Responsive Breakpoints

```
sm: 640px   - Mobile landscape
md: 768px   - Tablet
lg: 1024px  - Desktop (Sidebar visible)
xl: 1280px  - Large desktop
```

### Grid Patterns

```tsx
// Stats: 1 → 2 → 3 → 6 columns
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"

// Two columns
"grid grid-cols-1 lg:grid-cols-2 gap-6"

// Sidebar offset
"lg:ml-64" // When sidebar is expanded
"lg:ml-20" // When sidebar is collapsed
```

---

## Abhängigkeiten

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "@supabase/supabase-js": "^2.x",
    "react-apexcharts": "^1.x",
    "apexcharts": "^4.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "typescript": "^5.x",
    "@types/react": "^18.x",
    "@types/node": "^20.x"
  }
}
```

---

## Quick Start für neues Projekt

```bash
# 1. Next.js Projekt erstellen
npx create-next-app@latest my-dashboard --typescript --tailwind --app

# 2. Dependencies installieren
npm install @supabase/supabase-js react-apexcharts apexcharts

# 3. Diese Dateien kopieren:
#    - src/components/Sidebar/
#    - src/components/ThemeProvider.tsx
#    - src/components/FilterBar.tsx
#    - src/components/Cards/
#    - src/components/Charts/
#    - src/app/globals.css
#    - src/app/layout.tsx
#    - src/lib/supabase.ts

# 4. Tailwind config anpassen (darkMode: 'class')

# 5. Los geht's!
```

---

## Logo anpassen

Im Sidebar die Brand-Farbe und Buchstaben ändern:

```tsx
// Aktuell: Gold "P" für Palacios
<div style={{ backgroundColor: '#B9965A' }}>
  <span style={{ fontFamily: 'Georgia, Times, serif' }}>P</span>
</div>

// Für neues Projekt z.B.:
<div style={{ backgroundColor: '#3B82F6' }}>
  <span style={{ fontFamily: 'Georgia, Times, serif' }}>X</span>
</div>
```

---

*Dieses Design-Briefing enthält alles um das Whyros Dashboard-Design in einem neuen Projekt zu verwenden.*
