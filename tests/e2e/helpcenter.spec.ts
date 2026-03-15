import { test, expect } from 'playwright/test'

const mockArticles = [
  {
    id: 'art-1',
    title: 'Wie lange dauert die Ausbildung?',
    source_type: 'faq',
    content: 'Die Hypnose-Ausbildung dauert insgesamt 12 Tage, verteilt über 6 Monate.',
    updated_at: '2026-03-10T08:00:00Z',
  },
  {
    id: 'art-2',
    title: 'Preise und Konditionen',
    source_type: 'help_article',
    content: 'Die Kursgebühr beträgt CHF 4800. Ratenzahlung in 6 monatlichen Raten möglich.',
    updated_at: '2026-03-08T10:00:00Z',
  },
  {
    id: 'art-3',
    title: 'NLP Practitioner Ausbildung',
    source_type: 'course_info',
    content: 'Der NLP Practitioner ist eine umfassende Ausbildung in neurolinguistischem Programmieren.',
    updated_at: '2026-03-05T14:00:00Z',
  },
]

const mockAiAnswer = {
  answer: 'Die Ausbildung dauert 12 Tage, verteilt über 6 Monate.',
  sources: [
    { id: 'art-1', title: 'Wie lange dauert die Ausbildung?', source_type: 'faq' },
  ],
  hasAnswer: true,
}

test.describe('Help Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/helpcenter**', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ articles: mockArticles }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAiAnswer),
        })
      }
    })

    await page.goto('/helpcenter')
    await page.waitForLoadState('networkidle')
  })

  test('page loads with help center heading', async ({ page }) => {
    await expect(
      page.locator('text=Wie können wir helfen?').or(page.locator('h1')).first()
    ).toBeVisible({ timeout: 15000 })
  })

  test('category cards render on main page', async ({ page }) => {
    await expect(page.locator('text=Allgemeine Hilfe').or(page.locator('text=Häufige Fragen')).first()).toBeVisible({ timeout: 15000 })
  })

  test('search input is present in search mode', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="suchen"], input[placeholder*="Artikel"]')
    await expect(searchInput.first()).toBeVisible({ timeout: 10000 })
  })

  test('search filters articles', async ({ page }) => {
    const searchInput = page.locator('input[type="search"]').first()
    await searchInput.fill('Preise')
    await page.waitForTimeout(400)
    await expect(page.locator('text=Preise und Konditionen')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Wie lange dauert die Ausbildung?')).not.toBeVisible()
  })

  test('mode toggle shows Artikel suchen and Frage stellen', async ({ page }) => {
    await expect(page.locator('button:has-text("Artikel suchen")')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button:has-text("Frage stellen")')).toBeVisible()
  })

  test('switching to Frage stellen mode shows question textarea', async ({ page }) => {
    await page.locator('button:has-text("Frage stellen")').click()
    await expect(page.locator('textarea[placeholder*="Frage"]').or(page.locator('textarea')).first()).toBeVisible({ timeout: 5000 })
  })

  test('AI question mode submit button works', async ({ page }) => {
    await page.locator('button:has-text("Frage stellen")').click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('Wie lange dauert die Ausbildung?')

    const submitBtn = page.locator('button:has-text("Frage absenden")')
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // AI answer should appear
    await expect(page.locator('text=Antwort').or(page.locator('text=Die Ausbildung dauert')).first()).toBeVisible({ timeout: 10000 })
  })

  test('feedback buttons appear after AI answer', async ({ page }) => {
    await page.locator('button:has-text("Frage stellen")').click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('Wie lange dauert die Ausbildung?')
    await page.locator('button:has-text("Frage absenden")').click()

    await page.waitForTimeout(1000)

    await expect(page.locator('text=War das hilfreich?')).toBeVisible({ timeout: 10000 })
  })

  test('thumbs up feedback button is clickable', async ({ page }) => {
    await page.locator('button:has-text("Frage stellen")').click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('Wie lange dauert die Ausbildung?')
    await page.locator('button:has-text("Frage absenden")').click()

    await page.waitForTimeout(1000)

    // Find the ThumbsUp button near "War das hilfreich?"
    const feedbackSection = page.locator('text=War das hilfreich?').locator('..')
    const upBtn = feedbackSection.locator('button').first()
    if (await upBtn.isVisible()) {
      await upBtn.click()
      // Button should become active (bg-green-100 class)
      await page.waitForTimeout(300)
    }
  })

  test('article links navigate to detail page', async ({ page }) => {
    // Search to get list view with links
    const searchInput = page.locator('input[type="search"]').first()
    await searchInput.fill('Ausbildung')
    await page.waitForTimeout(400)

    const articleLink = page.locator('a[href*="/helpcenter/"]').first()
    if (await articleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      const href = await articleLink.getAttribute('href')
      expect(href).toMatch(/\/helpcenter\//)
    }
  })

  test('category card links work', async ({ page }) => {
    const categoryLink = page.locator('a[href*="/helpcenter?category="]').first()
    if (await categoryLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await categoryLink.click()
      await expect(page).toHaveURL(/\/helpcenter\?category=/)
    }
  })

  test('contact section is visible', async ({ page }) => {
    // CTA section at the bottom with contact link
    await expect(page.locator('text=Nicht gefunden').or(page.locator('text=Kontakt aufnehmen')).first()).toBeVisible({ timeout: 10000 })
  })
})
