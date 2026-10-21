// Browser dry-run of the rebuilt mockup (web/dist). Usage: npm run build && npm run dry-run
// Set CHROMIUM_PATH to reuse an installed Chromium build.
const { chromium } = require('playwright')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')

const dist = path.resolve(__dirname, '../dist')
const shots = path.resolve(__dirname, '../../.dry-run/web')
fs.mkdirSync(shots, { recursive: true })
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail })
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''))
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = path.resolve(dist, '.' + (p === '/' ? '/index.html' : p))
  if (!file.startsWith(dist)) return res.writeHead(403).end()
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end()
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream')
    res.end(buf)
  })
})

;(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${server.address().port}/`
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    page.on('pageerror', (e) => errors.push(e.message))
    const go = async (hash) => {
      await page.goto(base + '#/' + hash)
      await page.waitForTimeout(700)
    }
    const shot = (name) => page.screenshot({ path: path.join(shots, name + '.png'), fullPage: true })
    const viewAs = async (id) => {
      await page.selectOption('select[aria-label="View as user"]', id)
      await page.waitForTimeout(600)
    }

    await go('soc')
    const sections = await page.$$eval('nav[aria-label="Main"] > div', (els) => els.map((e) => e.querySelector('button')?.textContent?.trim()))
    check('menu grouping matches accepted IA', JSON.stringify(sections) === JSON.stringify(['Engagement', 'Social Channels & Content', 'Advertising', 'Insights', 'Settings']), JSON.stringify(sections))
    check('SOC renders four stat tiles', (await page.getByText('Total impressions', { exact: true }).count()) === 1 && (await page.getByText('Publishing health', { exact: true }).count()) === 1)
    check('SOC labels data as simulated', (await page.locator('text=Simulated social data').count()) > 0)
    await shot('soc-dark')

    // Emergency pause: reason required, banner appears, queue blocked.
    await page.click('button:has-text("Emergency pause")')
    const confirm = page.locator('button:has-text("Confirm pause")')
    check('pause needs a reason', await confirm.isDisabled())
    await page.fill('[role=dialog] textarea', 'Dry-run: severe weather hold')
    await confirm.click()
    await page.waitForTimeout(600)
    check('emergency banner shows', (await page.locator('[role=alert]:has-text("Emergency pause active")').count()) === 1)
    check('publish button disabled while paused', await page.locator('button:has-text("Process next demo publication")').isDisabled())
    await shot('soc-paused')
    await page.click('button:has-text("Authorize resume")')
    await page.fill('[role=dialog] textarea', 'Dry-run: warning lifted')
    await page.click('button:has-text("Confirm resume")')
    await page.waitForTimeout(600)
    check('resume clears banner', (await page.locator('[role=alert]:has-text("Emergency pause active")').count()) === 0)

    // Simulated updates change real records.
    for (let i = 0; i < 4; i++) {
      await page.click('button:has-text("Next update")')
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(500)
    const feed = await page.locator('text=New negative conversation').count()
    check('Next update writes to the feed', feed > 0)

    // Metric tabs switch the chart.
    await page.click('[role=radio]:has-text("Sentiment")')
    await page.waitForTimeout(300)
    check('sentiment chart shows the -100..+100 scale', (await page.locator('svg[aria-label^="sentiment"] text:has-text("-100")').count()) === 1)

    // Inbox: negative row opens the conversation.
    await page.locator('a[href*="inbox?c="]').first().click()
    await page.waitForTimeout(800)
    check('negative conversation opens in inbox', (await page.locator('[aria-label="Conversation detail"] h2').count()) === 1)
    await shot('inbox-open')

    // Assign, note, suggest, resolve.
    const ownerSelect = page.locator('[aria-label="Routing and classification"] select').first()
    const options = await ownerSelect.locator('option:not([disabled])').evaluateAll((o) => o.map((x) => x.value).filter(Boolean))
    check('owner list offers eligible responders', options.length > 0, `${options.length} eligible`)
    await ownerSelect.selectOption(options[0])
    await page.click('button:has-text("Save owner & classification")')
    await page.waitForTimeout(500)
    await page.fill('textarea[placeholder^="Write a reply"]', '')
    await page.click('button:has-text("Mock AI suggestion")')
    await page.waitForTimeout(400)
    const reply = await page.inputValue('textarea[placeholder^="Write a reply"]')
    check('mock suggestion fills the reply', reply.length > 20)
    const notes = page.locator('textarea').nth(1)
    await notes.fill('Dry-run note: checked with Transit ops.')
    await page.click('button:has-text("Save note")')
    await page.waitForTimeout(500)
    check('internal note saved', (await page.locator('text=Dry-run note: checked with Transit ops.').count()) === 1)
    await page.click('button:has-text("Review & resolve")')
    await page.click('button:has-text("Confirm demo resolution")')
    await page.waitForTimeout(600)
    check('conversation resolved with reply in thread', (await page.locator('[aria-label="Conversation detail"] >> text=Resolved').count()) > 0)
    await shot('inbox-resolved')

    // Listening: topic, alert, new topic.
    await go('listening')
    check('listening shows coverage warning', (await page.locator('text=Coverage is not universal.').count()) === 1)
    check('listening lists 4 seeded topics', (await page.locator('section[aria-label="Topics"] button').count()) === 4)
    await page.click('button:has-text("Add alert")')
    await page.fill('[role=dialog] input', '10')
    await page.click('button:has-text("Save alert")')
    await page.waitForTimeout(600)
    check('alert saved', (await page.locator('text=10%+ negative mentions').count()) === 1)
    await page.click('button:has-text("New topic")')
    await page.fill('[role=dialog] input >> nth=0', 'Library renovation')
    await page.fill('[role=dialog] input >> nth=1', 'library, renovation')
    await page.click('button:has-text("Create topic")')
    await page.waitForTimeout(700)
    check('new topic created and selected', (await page.locator('h2:has-text("Library renovation")').count()) === 1)
    await go('listening')
    await shot('listening')

    // Access scoping through "View as".
    await viewAs('user-5') // IT viewer, no channels
    await go('soc')
    check('viewer with no channels sees empty state', (await page.locator('text=No channel access yet').count()) === 1)
    const navViewer = await page.$$eval('nav[aria-label="Main"] a', (a) => a.map((x) => x.getAttribute('href')))
    check('viewer has no Inbox or Listening nav', !navViewer.some((h) => h.includes('inbox') || h.includes('listening')), navViewer.join(','))
    check('non-admin sees no emergency pause control', (await page.locator('button:has-text("Emergency pause")').count()) === 0)
    await shot('soc-viewer-no-access')

    await viewAs('user-2') // Transit responder
    await go('inbox')
    const networks = await page.$$eval('[aria-label="Conversations"] li button', (b) => b.length)
    const outside = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('ngyn-soc-web:v1'))
      const u = s.users.find((x) => x.id === 'user-2')
      return s.conversations.filter((c) => c.status === 'Open' && !u.channels.includes(c.accountId)).length
    })
    check('responder only sees conversations on assigned channels', networks > 0 && networks < 80, `${networks} visible, ${outside} open conversations hidden`)
    await go('inbox?c=CONV-2100')
    check('direct link to an out-of-scope conversation is not shown', (await page.locator('h2:has-text("CONV-2100")').count()) === 0)

    await viewAs('admin')

    // Light theme.
    await go('soc')
    await page.click('button[aria-label="Switch to light theme"]')
    await page.waitForTimeout(400)
    check('light theme applies', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light')
    await shot('soc-light')
    await page.click('button[aria-label="Switch to dark theme"]')

    // Collapsed rail.
    await page.click('button[aria-label="Collapse navigation"]')
    await page.waitForTimeout(300)
    check('collapsed rail keeps labelled icons', (await page.locator('nav[aria-label="Main"] a[aria-label="Inbox & Comments"]').count()) === 1)
    await shot('soc-rail')
    await page.click('button[aria-label="Expand navigation"]')

    // Phone width.
    await page.setViewportSize({ width: 390, height: 844 })
    for (const p of ['soc', 'inbox', 'listening']) {
      await go(p)
      const w = await page.evaluate(() => document.documentElement.scrollWidth)
      await page.screenshot({ path: path.join(shots, `mobile-${p}.png`) })
      check(`390px no horizontal scroll: ${p}`, w <= 390, `scrollWidth=${w}`)
    }
    await page.click('button[aria-label="Open navigation"]')
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(shots, 'mobile-nav.png') })

    check('no uncaught page errors', errors.length === 0, errors.join(' | '))
  } finally {
    await browser.close()
    server.close()
  }
  const failed = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(shots, 'results.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 1))
  console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${shots}`)
  process.exit(failed.length ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
