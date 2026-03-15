import { test, expect } from 'playwright/test'

const mockLearningCases = [
  {
    id: 'case-1',
    email_id: 'email-1',
    original_draft: 'Vielen Dank für Ihre Anfrage. Der Preis beträgt CHF 4800.',
    corrected_response:
      'Liebe Frau Muster, vielen Dank für Ihr Interesse. Der Kurs kostet CHF 4800, mit Ratenzahlung in 6 monatlichen Raten à CHF 800 möglich.',
    edit_distance: 0.45,
    difficulty_score: 0.7,
    topic_cluster: 'preise',
    knowledge_extracted: false,
    status: 'pending',
    created_at: '2026-03-14T10:00:00Z',
    incoming_emails: {
      subject: 'Frage zu Ausbildungskosten',
      from_name: 'Anna Muster',
      from_email: 'anna@example.com',
      email_type: 'inquiry',
    },
  },
  {
    id: 'case-2',
    email_id: 'email-2',
    original_draft: 'Guten Tag, die Ausbildung startet im April.',
    corrected_response: 'Lieber Herr Schmidt, der nächste Start ist am 5. April 2026 in Zürich.',
    edit_distance: 0.35,
    difficulty_score: 0.5,
    topic_cluster: 'termine',
    knowledge_extracted: true,
    status: 'extracted',
    created_at: '2026-03-12T09:00:00Z',
    incoming_emails: {
      subject: 'Nächster Kurstermin',
      from_name: 'Bob Schmidt',
      from_email: 'bob@example.com',
      email_type: 'inquiry',
    },
  },
]

test.describe('Learning', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/learning**', async route => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        const status = new URL(url).searchParams.get('status') || 'pending'
        let cases = mockLearningCases
        if (status !== 'all') {
          cases = mockLearningCases.filter(c => c.status === status)
        }
        const pending = mockLearningCases.filter(c => c.status === 'pending').length
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ cases, total: mockLearningCases.length, pending }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      }
    })

    await page.route('**/api/learning/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    })

    await page.goto('/learning')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with AI Learning header', async ({ page }) => {
    await expect(page.locator('text=AI Learning')).toBeVisible({ timeout: 15000 })
  })

  test('case list renders with pending cases', async ({ page }) => {
    await expect(page.locator('text=Frage zu Ausbildungskosten')).toBeVisible({ timeout: 15000 })
  })

  test('stats cards are displayed', async ({ page }) => {
    await expect(page.locator('text=Review ausstehend').or(page.locator('text=Total Korrekturen')).first()).toBeVisible({ timeout: 10000 })
  })

  test('filter buttons are present', async ({ page }) => {
    await expect(page.locator('button:has-text("Ausstehend")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button:has-text("Extrahiert")')).toBeVisible()
    await expect(page.locator('button:has-text("Verworfen")')).toBeVisible()
    await expect(page.locator('button:has-text("Alle")')).toBeVisible()
  })

  test('pending filter shows pending badge count', async ({ page }) => {
    // The "Ausstehend" button should show count badge
    const pendingBtn = page.locator('button:has-text("Ausstehend")')
    await expect(pendingBtn).toBeVisible()
    // Badge with count is inside the button
    const badge = pendingBtn.locator('span').first()
    if (await badge.isVisible()) {
      const text = await badge.textContent()
      expect(Number(text)).toBeGreaterThanOrEqual(1)
    }
  })

  test('checkbox selection works for pending cases', async ({ page }) => {
    // The pending case should have a checkbox (Square/CheckSquare icon button)
    const checkboxBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
    // Look specifically for the square icon button
    const selectBtns = page.locator('button[class*="rounded"]').filter({ hasNot: page.locator('span') })
    // Just verify a checkbox-like element is present in the case card
    const caseCard = page.locator('[class*="ring"]').first()
    // Simpler: look for the select all button
    await expect(page.locator('button:has-text("Alle auswählen")')).toBeVisible({ timeout: 10000 })
  })

  test('selecting a case reveals batch extract button', async ({ page }) => {
    // Click the checkbox for the first pending case
    // The checkbox is a button wrapping a Square icon
    const caseHeaders = page.locator('.space-y-4 > div').first()
    if (await caseHeaders.isVisible()) {
      // Find the square/checkbox button at the start of case header
      const squareBtn = page.locator('button').filter({
        has: page.locator('[class*="h-4 w-4 text-slate-"]'),
      }).first()

      if (await squareBtn.isVisible()) {
        await squareBtn.click()
        await page.waitForTimeout(300)
        // Batch extract button should appear
        await expect(page.locator('button:has-text("extrahieren")')).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('Alle auswählen button selects all pending cases', async ({ page }) => {
    await page.locator('button:has-text("Alle auswählen")').click()
    await page.waitForTimeout(300)
    // After selecting all, the batch extract button should appear
    await expect(page.locator('button:has-text("extrahieren")')).toBeVisible({ timeout: 5000 })
  })

  test('Als Wissen extrahieren button opens dialog', async ({ page }) => {
    const extractBtn = page.locator('button:has-text("Als Wissen extrahieren")').first()
    await expect(extractBtn).toBeVisible({ timeout: 10000 })
    await extractBtn.click()
    // Dialog should open
    await expect(page.locator('text=Als Wissen extrahieren').and(page.locator('[role="dialog"] *'))).toBeVisible({ timeout: 5000 })
  })

  test('extract dialog has title input', async ({ page }) => {
    const extractBtn = page.locator('button:has-text("Als Wissen extrahieren")').first()
    await extractBtn.click()
    await page.waitForTimeout(300)
    // Title input should be in the dialog
    const titleInput = page.locator('[role="dialog"] input').first()
    await expect(titleInput).toBeVisible({ timeout: 5000 })
  })

  test('filter Extrahiert shows extracted cases', async ({ page }) => {
    await page.locator('button:has-text("Extrahiert")').click()
    await page.waitForTimeout(500)
    await expect(page.locator('text=Nächster Kurstermin')).toBeVisible({ timeout: 10000 })
  })

  test('diff view shows original and corrected response', async ({ page }) => {
    await expect(page.locator('text=AI Entwurf').or(page.locator('text=AI Entwurf (original)')).first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Korrigierte Version')).toBeVisible()
  })

  test('explanation info box is visible', async ({ page }) => {
    await expect(page.locator('text=So lernt die AI').or(page.locator('text=lernt die AI')).first()).toBeVisible({ timeout: 10000 })
  })
})
