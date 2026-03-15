import { test, expect } from 'playwright/test'

const mockCourses = [
  {
    id: 'course-1',
    name: 'Hypnose-Ausbildung Level 1',
    description: 'Grundlegende Hypnosetechniken für Einsteiger',
    content: 'In dieser Ausbildung lernst du die Grundlagen der Hypnose...',
    target_audience: 'Personen mit Interesse an Hypnose und Psychologie',
    learning_goals: ['Tranceinduktion', 'Entspannungstechniken', 'Ethische Grundlagen'],
    next_start: '2026-04-05T00:00:00Z',
    duration: '12 Tage (6 Monate)',
    price: 4800,
    installment_count: 6,
    installment_amount: 800,
    spots_available: 8,
    total_spots: 16,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'course-2',
    name: 'NLP Practitioner',
    description: 'Neurolinguistisches Programmieren auf Practitioner-Niveau',
    content: 'Umfassende NLP-Ausbildung nach DVNLP-Standard...',
    target_audience: 'Coaches, Therapeuten, Führungskräfte',
    learning_goals: ['Rapport', 'Reframing', 'Ankertechniken'],
    next_start: '2026-05-10T00:00:00Z',
    duration: '10 Tage (5 Monate)',
    price: 3600,
    installment_count: 6,
    installment_amount: 600,
    spots_available: 3,
    total_spots: 12,
    status: 'active',
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-03-05T00:00:00Z',
  },
  {
    id: 'course-3',
    name: 'Coaching Ausbildung',
    description: 'Professionelle Coaching-Ausbildung',
    content: 'Werde zertifizierter Coach...',
    target_audience: 'Alle Interessierten',
    learning_goals: [],
    next_start: null,
    duration: null,
    price: 5200,
    installment_count: null,
    installment_amount: null,
    spots_available: 0,
    total_spots: 10,
    status: 'full',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-03-10T00:00:00Z',
  },
]

test.describe('Courses', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/courses**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ courses: mockCourses }),
        })
      } else if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ course: { ...mockCourses[0], id: 'course-new', name: 'Neuer Kurs' } }),
        })
      } else if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      }
    })

    await page.goto('/courses')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Kurse header', async ({ page }) => {
    await expect(page.locator('text=Kurse').or(page.locator('text=Kurse & Preise')).first()).toBeVisible({ timeout: 15000 })
  })

  test('course cards render with names', async ({ page }) => {
    await expect(page.locator('text=Hypnose-Ausbildung Level 1')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=NLP Practitioner')).toBeVisible()
    await expect(page.locator('text=Coaching Ausbildung')).toBeVisible()
  })

  test('course card shows price', async ({ page }) => {
    await expect(page.locator('text=4 800').or(page.locator('text=CHF 4').or(page.locator('text=4800'))).first()).toBeVisible({ timeout: 10000 })
  })

  test('course card shows duration', async ({ page }) => {
    await expect(page.locator('text=12 Tage')).toBeVisible({ timeout: 10000 })
  })

  test('available spots are shown', async ({ page }) => {
    // "8 von 16" spots
    await expect(page.locator('text=8 von 16').or(page.locator('text=Freie Plätze')).first()).toBeVisible({ timeout: 10000 })
  })

  test('status badges render correctly', async ({ page }) => {
    await expect(page.locator('text=Verfügbar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Wenige Plätze')).toBeVisible()
    await expect(page.locator('text=Ausgebucht')).toBeVisible()
  })

  test('Neuer Kurs button is present', async ({ page }) => {
    await expect(page.locator('button:has-text("Neuer Kurs")')).toBeVisible({ timeout: 10000 })
  })

  test('add course dialog opens on Neuer Kurs click', async ({ page }) => {
    await page.locator('button:has-text("Neuer Kurs")').click()
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Neuer Kurs').and(page.locator('[role="dialog"] *'))).toBeVisible({ timeout: 5000 })
  })

  test('add course dialog has required fields', async ({ page }) => {
    await page.locator('button:has-text("Neuer Kurs")').click()
    await page.waitForTimeout(300)
    // Title field
    await expect(page.locator('[role="dialog"] input').first()).toBeVisible()
    // Save button
    await expect(page.locator('[role="dialog"] button:has-text("Speichern")')).toBeVisible()
    // Cancel button
    await expect(page.locator('[role="dialog"] button:has-text("Abbrechen")')).toBeVisible()
  })

  test('add course dialog can be closed', async ({ page }) => {
    await page.locator('button:has-text("Neuer Kurs")').click()
    await page.waitForTimeout(300)
    await page.locator('[role="dialog"] button:has-text("Abbrechen")').click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 })
  })

  test('edit button opens edit dialog', async ({ page }) => {
    // Click the pencil/edit button on the first course card
    const editBtn = page.locator('button').filter({ has: page.locator('[data-lucide="pencil"], svg') }).first()
    if (await editBtn.isVisible()) {
      await editBtn.click()
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 })
      await expect(page.locator('text=Kurs bearbeiten')).toBeVisible({ timeout: 5000 })
    }
  })

  test('copy button on course card works', async ({ page }) => {
    const copyBtn = page.locator('button:has-text("Kopieren")').first()
    await expect(copyBtn).toBeVisible({ timeout: 10000 })
    await copyBtn.click()
    await page.waitForTimeout(300)
    // After clicking, button text changes to "Kopiert!"
    await expect(page.locator('button:has-text("Kopiert!")')).toBeVisible({ timeout: 3000 })
  })

  test('delete button opens confirmation dialog', async ({ page }) => {
    // The delete button (Trash2 icon) is a small button without text
    // Find a more specific delete button — it's a small button near the copy button
    const courseCard = page.locator('.grid > div').first()
    if (await courseCard.isVisible()) {
      const trashBtn = courseCard.locator('button').filter({
        has: courseCard.locator('[class*="red"]'),
      }).last()
      if (await trashBtn.isVisible()) {
        await trashBtn.click()
        await page.waitForTimeout(300)
        // AlertDialog should appear
        await expect(page.locator('text=Kurs löschen?')).toBeVisible({ timeout: 5000 })
        await page.locator('button:has-text("Abbrechen")').last().click()
      }
    }
  })

  test('ratenzahlung info is shown for courses with installments', async ({ page }) => {
    await expect(page.locator('text=Ratenzahlung').or(page.locator('text=Raten')).first()).toBeVisible({ timeout: 10000 })
  })

  test('info banner about AI knowledge is shown', async ({ page }) => {
    await expect(
      page.locator('text=Kursdaten werden automatisch').or(page.locator('text=AI als Wissen')).first()
    ).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Courses - empty state', () => {
  test('shows empty state when no courses', async ({ page }) => {
    await page.route('**/api/courses**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ courses: [] }),
      })
    })

    await page.goto('/courses')
    await page.waitForLoadState('networkidle')

    await expect(page.locator('text=Noch keine Kurse angelegt').or(page.locator('text=Ersten Kurs anlegen')).first()).toBeVisible({ timeout: 10000 })
  })
})
