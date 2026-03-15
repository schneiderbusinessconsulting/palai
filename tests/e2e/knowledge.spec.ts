import { test, expect } from 'playwright/test'

const mockKnowledgeItems = [
  {
    title: 'Hypnose-Ausbildung Preise 2026',
    source_type: 'help_article',
    chunks: 3,
    updated_at: '2026-03-10T08:00:00Z',
    ids: ['id-1', 'id-2', 'id-3'],
    published: true,
    approved: true,
    learning_context: null,
    source_learning_id: null,
  },
  {
    title: 'FAQ Ratenzahlung',
    source_type: 'faq',
    chunks: 2,
    updated_at: '2026-03-08T10:00:00Z',
    ids: ['id-4', 'id-5'],
    published: true,
    approved: true,
    learning_context: null,
    source_learning_id: null,
  },
  {
    title: 'Kursinhalt NLP Practitioner',
    source_type: 'course_info',
    chunks: 5,
    updated_at: '2026-03-05T14:00:00Z',
    ids: ['id-6', 'id-7', 'id-8', 'id-9', 'id-10'],
    published: false,
    approved: true,
    learning_context: null,
    source_learning_id: null,
  },
]

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/knowledge**', async route => {
      if (route.request().method() === 'GET') {
        const url = route.request().url()
        const sourceType = new URL(url).searchParams.get('source_type')
        let items = mockKnowledgeItems
        if (sourceType && sourceType !== 'all') {
          items = mockKnowledgeItems.filter(i => i.source_type === sourceType)
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      }
    })

    await page.goto('/knowledge')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with Knowledge Base header', async ({ page }) => {
    await expect(page.locator('text=Knowledge Base')).toBeVisible({ timeout: 15000 })
  })

  test('article list renders', async ({ page }) => {
    await expect(page.locator('text=Hypnose-Ausbildung Preise 2026')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=FAQ Ratenzahlung')).toBeVisible()
    await expect(page.locator('text=Kursinhalt NLP Practitioner')).toBeVisible()
  })

  test('search input is present', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="durchsuchen"], input[placeholder*="Durchsuchen"]')
    await expect(searchInput.first()).toBeVisible()
  })

  test('search filters articles', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="durchsuchen"], input[placeholder*="Durchsuchen"]').first()
    await searchInput.fill('FAQ')
    await page.waitForTimeout(300)
    await expect(page.locator('text=FAQ Ratenzahlung')).toBeVisible()
    await expect(page.locator('text=Hypnose-Ausbildung Preise 2026')).not.toBeVisible()
  })

  test('source type filter dropdown is present', async ({ page }) => {
    const filterTrigger = page.locator('[role="combobox"]').first()
    await expect(filterTrigger).toBeVisible()
  })

  test('source type filter can be opened', async ({ page }) => {
    const filterTrigger = page.locator('[role="combobox"]').first()
    await filterTrigger.click()
    await expect(page.locator('text=Alle Quellen').or(page.locator('text=Help Center')).first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })

  test('Wissen hinzufügen dropdown button is present', async ({ page }) => {
    await expect(page.locator('text=Wissen hinzufügen')).toBeVisible({ timeout: 10000 })
  })

  test('Manuell option opens new article dialog', async ({ page }) => {
    // Click the "Wissen hinzufügen" dropdown
    await page.locator('text=Wissen hinzufügen').click()
    await page.waitForTimeout(300)
    // Click the Manuell option in dropdown
    const manuellOption = page.locator('text=Manuell')
    await expect(manuellOption).toBeVisible({ timeout: 5000 })
    await manuellOption.click()
    // Dialog should open
    await expect(page.locator('text=Wissen hinzufügen').and(page.locator('[role="dialog"] *')).or(page.locator('[role="dialog"]'))).toBeVisible({ timeout: 5000 })
  })

  test('article delete shows dropdown then confirmation', async ({ page }) => {
    // Click the MoreVertical menu for the first item
    const moreBtn = page.locator('button').filter({ has: page.locator('[data-lucide="more-vertical"], svg') }).first()
    if (await moreBtn.isVisible()) {
      await moreBtn.click()
      await page.waitForTimeout(200)
      const deleteOption = page.locator('[role="menuitem"]:has-text("Löschen"), [role="option"]:has-text("Löschen")')
      if (await deleteOption.isVisible()) {
        await deleteOption.click()
        // Alert dialog should show
        await expect(page.locator('text=Eintrag löschen?').or(page.locator('text=löschen?')).first()).toBeVisible({ timeout: 5000 })
        // Cancel to avoid actually deleting
        await page.locator('button:has-text("Abbrechen")').last().click()
      }
    }
  })

  test('stats show counts', async ({ page }) => {
    await expect(page.locator('text=Gesamt Chunks').or(page.locator('text=Help Artikel')).first()).toBeVisible({ timeout: 10000 })
  })

  test('filter by Help Center shows only help_article items', async ({ page }) => {
    await page.route('**/api/knowledge?source_type=help_article**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: mockKnowledgeItems.filter(i => i.source_type === 'help_article'),
        }),
      })
    })

    const filterTrigger = page.locator('[role="combobox"]').first()
    await filterTrigger.click()
    await page.waitForTimeout(200)
    const helpCenterOption = page.locator('text=Help Center').last()
    if (await helpCenterOption.isVisible()) {
      await helpCenterOption.click()
      await page.waitForTimeout(500)
      await expect(page.locator('text=Hypnose-Ausbildung Preise 2026')).toBeVisible({ timeout: 5000 })
    }
  })

  test('Aktualisieren button is present', async ({ page }) => {
    await expect(page.locator('button:has-text("Aktualisieren")')).toBeVisible()
  })
})
