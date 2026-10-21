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
    check('inbox has no ticket-style priority', (await page.getByText(/priority|critical/i).count()) === 0)
    const firstBadges = await page.locator('[aria-label="Conversations"] li').first().innerText()
    check('inbox sorts most negative first by default', firstBadges.includes('Negative'), firstBadges.split('\n').slice(-3).join(' '))

    // Assign, note, suggest, resolve.
    const ownerSelect = page.locator('[aria-label="Routing and classification"] select').first()
    const options = await ownerSelect.locator('option:not([disabled])').evaluateAll((o) => o.map((x) => x.value).filter(Boolean))
    check('owner list offers eligible responders', options.length > 0, `${options.length} eligible`)
    await ownerSelect.selectOption(options[0])
    await page.click('button:has-text("Save owner & sentiment")')
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

    // ---------- § 2a Social Channels ----------
    await go('channels')
    check('channels: access callout shown', (await page.locator('text=Creating or linking a channel grants nobody access.').count()) === 1)
    check('channels: 18 seeded connections listed', (await page.locator('main ul > li:has(button:has-text("Manage"))').count()) === 18)
    await shot('channels')
    await page.click('button:has-text("Add social channel")')
    await page.click('[role=dialog] button:has-text("X")')
    await page.fill('[role=dialog] input >> nth=0', 'Harbourview Snow Alerts')
    await page.click('button:has-text("Create channel")')
    await page.waitForTimeout(700)
    const newRow = page.locator('main li:has-text("Harbourview Snow Alerts")')
    check('channels: new channel starts unlinked with no access', (await newRow.count()) === 1 && (await newRow.innerText()).includes('Unlinked') && (await newRow.innerText()).includes('0 people'))
    await page.locator('main li:has-text("@HarbourviewMunicipality") button:has-text("Manage")').click()
    await page.waitForTimeout(600)
    check('channels: who-has-access lists direct and group access', (await page.locator('[role=dialog] >> text=Group role: content creator').count()) > 0 && (await page.locator('[role=dialog] >> text=Direct assignment').count()) > 0)
    await shot('channel-manage')
    await page.click('button:has-text("Mock reconnect")')
    await page.waitForTimeout(600)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('channels: mock reconnect clears expired state', (await page.locator('main li:has-text("@HarbourviewMunicipality")').innerText()).includes('Connected'))
    await page.click('[role=radio]:has-text("Platform capabilities")')
    await page.waitForTimeout(300)
    check('channels: capability view marks YouTube DMs unavailable', (await page.locator('section:has(h2:text-is("YouTube")) li:has-text("Direct messages") >> text=Not available').count()) === 1)
    await shot('channels-capabilities')

    // ---------- § 2a Asset Groups ----------
    await go('assets')
    check('groups: 6 seeded groups listed', (await page.locator('nav[aria-label="Asset Groups"] > button').count()) === 6)
    await shot('groups-channels')
    // Link the new channel to the IT group (deleted later, so we also prove deletion unlinks it).
    await page.click('nav[aria-label="Asset Groups"] button:has-text("Harbourview IT")')
    await page.waitForTimeout(500)
    await page.click('main button:has-text("Link channels") >> nth=0')
    await page.locator('[role=dialog] label:has-text("Harbourview Snow Alerts") input').check()
    check('groups: channels in another group are locked in the link dialog', (await page.locator('[role=dialog] label:has-text("in Harbourview Transit") input[disabled]').count()) > 0)
    await page.click('button:has-text("Save links")')
    await page.waitForTimeout(600)
    check('groups: channel linked', (await page.locator('main li:has-text("Harbourview Snow Alerts")').count()) === 1)

    // People: explicit channel selection required.
    await page.click('nav[aria-label="Asset Groups"] button:has-text("Harbourview Communications")')
    await page.waitForTimeout(500)
    await page.click('[role=tab]:has-text("People & access")')
    await page.waitForTimeout(300)
    await page.locator('text=Lily Green').first().waitFor({ timeout: 3000 }).catch(() => {})
    check('people: group-only creator listed', (await page.locator('section:has(h3:text-is("Content creators")) >> text=Lily Green').count()) === 1)
    await page.click('button:has-text("Add content approvers")')
    await page.locator('[role=dialog] label:has-text("Leo Adams") input').check()
    check('people: assign disabled until a channel is selected', await page.locator('[role=dialog] button:has-text("Assign")').isDisabled())
    await page.locator('[role=dialog] label:has-text("Harbourview Council News") input').check()
    await page.click('[role=dialog] button:has-text("Assign")')
    await page.waitForTimeout(600)
    check('people: approver assigned with one channel', (await page.locator('section:has(h3:text-is("Content approvers")) >> text=Leo Adams').count()) === 1)
    await shot('groups-people')

    // Brand: master change sends reviewed sets back to review.
    await page.click('[role=tab]:has-text("Brand direction")')
    await page.waitForTimeout(400)
    await shot('groups-brand-master')
    const dontField = page.locator('label:text-is("DON’T (one rule per line)") + textarea')
    await dontField.fill((await dontField.inputValue()) + '\nNever use sarcasm about service failures.')
    check('brand: re-review warning appears before save', (await page.locator('text=/Saving sends \\d+ reviewed item/').count()) === 1)
    await page.click('button:has-text("Save master direction")')
    await page.waitForTimeout(700)
    await page.click('[role=radio]:has-text("Guideline sets")')
    await page.waitForTimeout(300)
    check('brand: reviewed set is back to Needs review', (await page.locator('button:has-text("Service notices") >> text=Needs review').count()) === 1)
    await page.locator('label:has-text("I reviewed this guideline") input').check()
    await page.click('button:has-text("Save as reviewed")')
    await page.waitForTimeout(600)
    check('brand: set re-reviewed', (await page.locator('button:has-text("Service notices") >> text=Reviewed').count()) === 1)
    await page.click('button:has-text("Brief preview")')
    await page.waitForTimeout(500)
    const briefText = await page.locator('[role=dialog]').innerText()
    check('brand: brief lists master rules before guideline additions', briefText.indexOf('1 · Master') < briefText.indexOf('2 · Guideline') && briefText.includes('Never use sarcasm'))
    check('brand: reviewed brief is downloadable', !(await page.locator('button:has-text("Download brief")').isDisabled()))
    await shot('groups-brief')
    await page.keyboard.press('Escape')
    // Incomplete set cannot be marked reviewed.
    await page.click('button:has-text("Add guideline set")')
    await page.locator('button[aria-current=true]:has-text("New guideline")').waitFor({ timeout: 3000 }).catch(() => {})
    check('brand: incomplete set cannot be attested', await page.locator('label:has-text("I reviewed this guideline") input').isDisabled())
    await shot('groups-brand-sets')

    // Brand Voice: https required, review, apply.
    await page.click('[role=tab]:has-text("Brand voices")')
    await page.click('button:has-text("Create Brand Voice")')
    await page.fill('[role=dialog] input >> nth=0', 'Storm updates voice')
    await page.fill('[role=dialog] input[type=url]', 'http://harbourview.example')
    await page.click('button:has-text("Generate mock draft")')
    await page.waitForTimeout(500)
    check('voice: non-HTTPS website rejected', (await page.locator('text=Enter a valid HTTPS website URL.').count()) > 0)
    await page.fill('[role=dialog] input[type=url]', 'https://harbourview.example/storms')
    await page.click('button:has-text("Generate mock draft")')
    await page.waitForTimeout(600)
    check('voice: draft opens for review, labelled simulated', (await page.locator('[role=dialog] >> text=Simulated draft · no AI call').count()) === 1)
    await page.locator('[role=dialog] label:has-text("I reviewed this voice") input').check()
    await page.click('button:has-text("Save as reviewed")')
    await page.waitForTimeout(600)
    await page.locator('section:has(h3:text-is("Storm updates voice")), div:has(> div > div > h3:text-is("Storm updates voice"))').first()
    await page.locator('button:has-text("Apply to guideline")').last().click()
    await page.click('[role=dialog] button:has-text("Apply voice")')
    await page.waitForTimeout(600)
    await page.click('[role=tab]:has-text("Brand direction")')
    await page.click('[role=radio]:has-text("Guideline sets")')
    await page.waitForTimeout(300)
    check('voice: applying sends the set back to review', (await page.locator('button:has-text("Service notices") >> text=Needs review').count()) === 1)
    await page.click('[role=tab]:has-text("Brand voices")')
    await shot('groups-voices')

    // Delete: unlinks channels, keeps them.
    await page.click('nav[aria-label="Asset Groups"] button:has-text("Harbourview IT")')
    await page.waitForTimeout(500)
    await page.click('button:has-text("Delete group")')
    check('delete: needs typed confirmation', await page.locator('[role=dialog] button:has-text("Delete group")').isDisabled())
    await page.fill('[role=dialog] input', 'DELETE')
    await page.click('[role=dialog] button:has-text("Delete group")')
    await page.waitForTimeout(700)
    check('delete: group removed', (await page.locator('nav[aria-label="Asset Groups"] > button').count()) === 5)
    await go('channels')
    const itRows = await page.locator('main li:has-text("Digital"), main li:has-text("Council TV"), main li:has-text("Snow Alerts")').allInnerTexts()
    check('delete: channels kept and unlinked', itRows.length >= 4 && itRows.every((t) => t.includes('Unlinked')), `${itRows.length} rows`)

    // Scoped group editing.
    await viewAs('user-18') // Communications approver with assets.manage
    await go('assets')
    const leoGroups = await page.locator('nav[aria-label="Asset Groups"] > button').allInnerTexts()
    check('scope: only groups fully inside the user scope are shown', leoGroups.length === 1 && leoGroups[0].includes('Communications'), leoGroups.map((t) => t.split('\n')[0]).join(','))
    check('scope: manager without assets.delete sees no delete', (await page.locator('button:has-text("Delete group")').count()) === 0)
    const leoNav = await page.$$eval('nav[aria-label="Main"] a', (a) => a.map((x) => x.getAttribute('href')))
    check('scope: no Social Channels nav without channels.manage', !leoNav.some((h) => h.includes('channels')))
    await viewAs('user-11') // IT editor with channels.manage
    await go('channels')
    check('scope: channel manager sees only assigned channels', (await page.locator('main ul > li:has(button:has-text("Manage"))').count()) === 3)
    await viewAs('admin')

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
    for (const p of ['soc', 'inbox', 'listening', 'channels', 'assets?tab=brand']) {
      await go(p)
      const w = await page.evaluate(() => document.documentElement.scrollWidth)
      await page.screenshot({ path: path.join(shots, `mobile-${p.split('?')[0]}.png`) })
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
