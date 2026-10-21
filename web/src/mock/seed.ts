import type {
  AssetGroup,
  Category,
  Conversation,
  DemoState,
  Department,
  FunctionId,
  ListeningAlert,
  ListeningTopic,
  Mention,
  MentionSource,
  Network,
  Post,
  PostStatus,
  Sentiment,
  SocialAccount,
  StaffRole,
  User,
} from '@/domain/types'

// Deterministic fictional seed. Every name, handle, message and metric here is invented.
// Counts follow the brief: 18 accounts, 30 staff, 80 conversations, 42 posts.

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEPARTMENTS: Department[] = ['Communications', 'Public Works', 'Transit', 'Recreation', 'Customer Service', 'IT']

const ROLE_FUNCTIONS: Record<StaffRole, FunctionId[]> = {
  Administrator: ['content.create', 'content.approve', 'content.publish', 'inbox.respond', 'reports.view', 'ads.create', 'ads.manage', 'ads.accounts.add'],
  Approver: ['content.create', 'content.approve', 'content.publish', 'reports.view'],
  Editor: ['content.create'],
  Responder: ['inbox.respond'],
  Analyst: ['reports.view'],
  Viewer: [],
}

const STAFF: [string, Department, StaffRole][] = [
  ['Avery Morgan', 'Communications', 'Administrator'],
  ['Maya Chen', 'Public Works', 'Editor'],
  ['Noah Grant', 'Transit', 'Responder'],
  ['Emma Roy', 'Recreation', 'Approver'],
  ['Liam Brooks', 'Customer Service', 'Analyst'],
  ['Sofia Patel', 'IT', 'Viewer'],
  ['Oliver Reed', 'Communications', 'Editor'],
  ['Chloe Martin', 'Public Works', 'Responder'],
  ['Ethan Ross', 'Transit', 'Approver'],
  ['Amelia King', 'Recreation', 'Analyst'],
  ['Lucas Bell', 'Customer Service', 'Viewer'],
  ['Isla Moore', 'IT', 'Editor'],
  ['Mason Clark', 'Communications', 'Responder'],
  ['Harper Wood', 'Public Works', 'Approver'],
  ['Logan Scott', 'Transit', 'Analyst'],
  ['Ella Davis', 'Recreation', 'Viewer'],
  ['Jacob Hall', 'Customer Service', 'Editor'],
  ['Grace Wilson', 'IT', 'Responder'],
  ['Leo Adams', 'Communications', 'Approver'],
  ['Zoe Carter', 'Public Works', 'Analyst'],
  ['Henry Young', 'Transit', 'Viewer'],
  ['Lily Green', 'Recreation', 'Editor'],
  ['Owen Baker', 'Customer Service', 'Responder'],
  ['Aria Walker', 'IT', 'Approver'],
  ['Jack Turner', 'Communications', 'Analyst'],
  ['Nora Hill', 'Public Works', 'Viewer'],
  ['Finn Lewis', 'Transit', 'Editor'],
  ['Ruby Allen', 'Recreation', 'Responder'],
  ['Theo Wright', 'Customer Service', 'Approver'],
  ['Mila Evans', 'IT', 'Analyst'],
]

const ACCOUNTS: [string, string, Network, Department, SocialAccount['connection']['status']][] = [
  ['Municipality of Harbourview', '@HarbourviewMunicipality', 'Facebook', 'Communications', 'Expired'],
  ['Harbourview Public Works', '@HVPublicWorks', 'Facebook', 'Public Works', 'Healthy'],
  ['Harbourview Transit', '@HVTransit', 'Facebook', 'Transit', 'Healthy'],
  ['Harbourview Recreation', '@HVRecreation', 'Facebook', 'Recreation', 'Healthy'],
  ['Harbourview 311', '@Harbourview311', 'Facebook', 'Customer Service', 'Healthy'],
  ['Harbourview Digital Services', '@HVDigital', 'Facebook', 'IT', 'Expiring'],
  ['Harbourview Council News', '@HVCouncilNews', 'Facebook', 'Communications', 'Healthy'],
  ['Harbourview Snow & Roads', '@HVSnowRoads', 'Facebook', 'Public Works', 'Healthy'],
  ['harbourview.transit', '@harbourview.transit', 'Instagram', 'Transit', 'Expired'],
  ['harbourview.rec', '@harbourview.rec', 'Instagram', 'Recreation', 'Healthy'],
  ['Harbourview 311', '@harbourview311.bsky.social', 'Bluesky', 'Customer Service', 'Healthy'],
  ['HV Digital', '@hvdigital.bsky.social', 'Bluesky', 'IT', 'Healthy'],
  ['Harbourview', '@harbourview.bsky.social', 'Bluesky', 'Communications', 'Healthy'],
  ['HV Public Works', '@hvpublicworks.bsky.social', 'Bluesky', 'Public Works', 'Healthy'],
  ['HV Transit', '@hvtransit.bsky.social', 'Bluesky', 'Transit', 'Healthy'],
  ['HV Recreation', '@hvrec.bsky.social', 'Bluesky', 'Recreation', 'Healthy'],
  ['Municipality of Harbourview', 'linkedin.com/company/harbourview-fictional', 'LinkedIn', 'Communications', 'Expired'],
  ['Harbourview Council TV', '@HarbourviewCouncilTV', 'YouTube', 'IT', 'Healthy'],
]

const GROUP_COLORS = ['#d0fc70', '#a4b8da', '#9fcabf', '#d5ba8e', '#b7a3d4', '#c4ccaa']

const POST_TEMPLATES: [Department, string, string][] = [
  ['Communications', 'Council meeting recap', 'Read the highlights from this week’s council meeting, including the 2027 budget timeline and how to share your feedback.'],
  ['Communications', 'Budget survey open', 'The 2027 budget survey is open until November 15. It takes about 6 minutes and helps council set priorities.'],
  ['Communications', 'Remembrance Day hours', 'Municipal offices are closed on November 11. Waste collection runs on its regular schedule.'],
  ['Public Works', 'Fall leaf collection', 'Fall leaf collection begins Monday. Place paper yard-waste bags at the curb by 7 a.m. on your collection day.'],
  ['Public Works', 'Alder Street water main repair', 'Crews are repairing a water main on Alder Street between 2nd and 4th Avenue. Expect lane closures until 6 p.m.'],
  ['Public Works', 'Winter parking ban', 'The overnight winter parking ban starts December 1, from 1 a.m. to 6 a.m. It lets plows clear streets curb to curb.'],
  ['Transit', 'Route 8 detour', 'Route 8 is using a temporary detour. Accessible boarding is available at the temporary Alder Street stop.'],
  ['Transit', 'Holiday transit schedule', 'Transit runs a Sunday schedule on holidays. Plan your trip with the online trip planner.'],
  ['Transit', 'New accessible buses', 'Twelve new low-floor accessible buses join the fleet this month on Routes 2, 5 and 8.'],
  ['Recreation', 'Community swim registration', 'Winter swim lesson registration opens Saturday at 9 a.m. Spaces are limited, and fee assistance is available.'],
  ['Recreation', 'Explore the waterfront trail', 'A little fresh air, close to home. The waterfront trail is fully open, with accessible boardwalk sections.'],
  ['Customer Service', '311 extended hours', '311 is now open until 8 p.m. on weekdays. Call 311 or use the online service request form.'],
  ['Customer Service', 'Property tax reminder', 'The second property tax instalment is due October 31. Pay online, by phone or in person.'],
  ['IT', 'Council meetings streaming', 'Watch council meetings live on our YouTube channel, with captions. Archived meetings are available the next day.'],
]

interface ConversationTemplate {
  text: string
  category: Category
  sentiment: Sentiment
  kind: 'Comment' | 'Message'
  department: Department
}

const CONVERSATION_TEMPLATES: ConversationTemplate[] = [
  { text: 'Water is collecting at the Alder Street underpass. Is the road closed?', category: 'Emergency', sentiment: 'Negative', kind: 'Message', department: 'Public Works' },
  { text: 'Third day in a row my street has not been plowed. This is ridiculous.', category: 'Roads', sentiment: 'Negative', kind: 'Comment', department: 'Public Works' },
  { text: 'There is a pothole on Maple Drive near the school that is getting dangerous.', category: 'Roads', sentiment: 'Concerned', kind: 'Comment', department: 'Public Works' },
  { text: 'The Route 8 detour notice was unclear. Where is the accessible boarding stop?', category: 'Transit', sentiment: 'Negative', kind: 'Comment', department: 'Transit' },
  { text: 'Bus 5 skipped my stop again this morning and I was late for work.', category: 'Transit', sentiment: 'Negative', kind: 'Message', department: 'Transit' },
  { text: 'Will the holiday schedule apply on Boxing Day too?', category: 'Transit', sentiment: 'Neutral', kind: 'Comment', department: 'Transit' },
  { text: 'Love the new low-floor buses. Much easier with my stroller!', category: 'Transit', sentiment: 'Positive', kind: 'Comment', department: 'Transit' },
  { text: 'Swim registration crashed at 9:01 and now everything is full. Very frustrating.', category: 'Recreation', sentiment: 'Negative', kind: 'Comment', department: 'Recreation' },
  { text: 'Is fee assistance available for the winter skating program?', category: 'Recreation', sentiment: 'Neutral', kind: 'Message', department: 'Recreation' },
  { text: 'The waterfront trail looks amazing this fall. Thank you to the crews.', category: 'Recreation', sentiment: 'Positive', kind: 'Comment', department: 'Recreation' },
  { text: 'My green bin was not picked up on Tuesday. Who do I contact?', category: 'Waste', sentiment: 'Concerned', kind: 'Message', department: 'Customer Service' },
  { text: 'Why are leaf bags not allowed in plastic? That makes no sense.', category: 'Waste', sentiment: 'Concerned', kind: 'Comment', department: 'Public Works' },
  { text: 'I have been on hold with 311 for 40 minutes. Unacceptable.', category: 'General', sentiment: 'Negative', kind: 'Comment', department: 'Customer Service' },
  { text: 'How do I apply for a permit to build a backyard deck?', category: 'Permits', sentiment: 'Neutral', kind: 'Message', department: 'Customer Service' },
  { text: 'My building permit application has been pending for six weeks with no update.', category: 'Permits', sentiment: 'Negative', kind: 'Message', department: 'Customer Service' },
  { text: 'Thanks for extending 311 hours. Very helpful for shift workers.', category: 'General', sentiment: 'Positive', kind: 'Comment', department: 'Customer Service' },
  { text: 'The budget survey link on your post goes to an error page.', category: 'General', sentiment: 'Concerned', kind: 'Comment', department: 'Communications' },
  { text: 'Council keeps raising taxes and services keep getting worse.', category: 'General', sentiment: 'Negative', kind: 'Comment', department: 'Communications' },
  { text: 'Where can I watch last night’s council meeting? The stream cut out.', category: 'General', sentiment: 'Concerned', kind: 'Comment', department: 'IT' },
  { text: 'Captions on the council stream were great, thank you for adding them.', category: 'General', sentiment: 'Positive', kind: 'Comment', department: 'IT' },
  { text: 'There is a downed tree blocking Harbour Road near the marina.', category: 'Emergency', sentiment: 'Concerned', kind: 'Message', department: 'Public Works' },
  { text: 'Streetlight out on Birch Lane for two weeks now. Feels unsafe walking home.', category: 'Roads', sentiment: 'Negative', kind: 'Message', department: 'Public Works' },
  { text: 'Is the online tax payment portal down? It keeps timing out.', category: 'General', sentiment: 'Concerned', kind: 'Message', department: 'IT' },
  { text: 'Great job on the Remembrance Day ceremony livestream.', category: 'General', sentiment: 'Positive', kind: 'Comment', department: 'Communications' },
]

const STAFF_REPLIES: Record<Category, string> = {
  Roads: 'Thanks for reporting this. We have logged it with Public Works and a crew will assess it.',
  Transit: 'Thank you. We have shared this with Transit operations and will follow up here.',
  Recreation: 'Thanks for reaching out. Our Recreation team will reply with details shortly.',
  Permits: 'Thanks for your patience. A permit coordinator will review your file and contact you.',
  Waste: 'Sorry about that. We have flagged your address for a follow-up collection.',
  Emergency: 'Thank you. For immediate danger, call 911. Crews have been notified.',
  General: 'Thanks for your message. We are looking into it and will update you.',
}

const AI_BASE: Record<Sentiment, number> = { Negative: -78, Concerned: -52, Neutral: 4, Positive: 72 }

const RESIDENT_HANDLES = ['maple_reader', 'harbour_mom', 'cyclist_hv', 'northend_neighbour', 'jdawson', 'birchlane_res', 'quietcommuter', 'skatepark_dad', 'oldtown_resident', 'trailrunner_hv', 'k_li', 'pat.m', 'sam_rivera', 'westside_wendy', 'r_okafor', 'hv_student']

const TOPICS: [string, string[]][] = [
  ['Winter road maintenance', ['snow', 'plow', 'salt', '#hvsnow', 'parking ban']],
  ['Route 8 detour', ['route 8', 'detour', 'alder street', 'accessible stop']],
  ['Waterfront redevelopment', ['waterfront', 'pier', 'boardwalk', '#hvwaterfront']],
  ['Flooding and water mains', ['flooding', 'underpass', 'water main', 'basement']],
]

const MENTION_TEXT: Record<number, [string, number][]> = {
  0: [
    ['Plows were out early on the north end today, roads are in decent shape.', 45],
    ['Still no plow on Cedar Crescent. Is anyone coming? #hvsnow', -70],
    ['Reminder from a neighbour: the parking ban starts Dec 1, move your car.', 10],
    ['Salt trucks missed the hill by the school again. Kids slipping everywhere.', -62],
    ['Harbourview snow clearing is better than last year, honestly.', 55],
  ],
  1: [
    ['Route 8 detour added 15 minutes to my commute, but the signage is clear.', -10],
    ['Nobody knows where the accessible stop is on the Route 8 detour.', -74],
    ['Alder Street detour stop has a shelter now, thanks.', 40],
    ['Route 8 drivers have been really patient with the detour chaos.', 50],
  ],
  2: [
    ['The new boardwalk section on the waterfront is beautiful.', 80],
    ['Waterfront redevelopment means more condos and less public space. #hvwaterfront', -55],
    ['Pier lighting looks great at night now.', 60],
    ['Council should publish the waterfront traffic study before approving phase 2.', -30],
  ],
  3: [
    ['Alder Street underpass flooded again after the rain.', -80],
    ['Water main break on 3rd Ave, crews already on site.', -5],
    ['Basement flooding grant program is a good idea, how do I apply?', 20],
    ['Third flood this year at the underpass. When is the fix?', -85],
  ],
}

const SOURCES: [MentionSource, Network | 'Web'][] = [
  ['Owned comment', 'Facebook'],
  ['Public post', 'Bluesky'],
  ['Public post', 'X'],
  ['Owned comment', 'Instagram'],
  ['News', 'Web'],
  ['Forum', 'Web'],
  ['Blog', 'Web'],
]

const iso = (ms: number) => new Date(ms).toISOString()

export function createSeed(now = Date.now()): DemoState {
  const r = rng(20261021)
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const hour = 3600_000
  const day = 24 * hour

  const accounts: SocialAccount[] = ACCOUNTS.map(([name, handle, network, department, status], i) => ({
    id: `social-${i}`,
    name,
    handle,
    network,
    department,
    assetGroupId: i === 11 ? null : `asset-${DEPARTMENTS.indexOf(department)}`,
    connection: {
      status,
      expiresAt: iso(status === 'Expired' ? now - 2 * day : status === 'Expiring' ? now + 3 * day : now + (40 + i) * day),
      lastSync: iso(now - (5 + i * 7) * 60_000),
    },
  }))

  const deptAccounts = (d: Department) => accounts.filter((a) => a.department === d).map((a) => a.id)

  const users: User[] = STAFF.map(([name, department, role], i) => {
    const id = `user-${i}`
    let channels = role === 'Administrator' ? [] : deptAccounts(department)
    // Deliberate access edge cases for "View as user" testing.
    if (id === 'user-5') channels = [] // new IT viewer, no channels assigned yet
    if (id === 'user-22') channels = [...deptAccounts('Customer Service'), ...deptAccounts('Communications')] // 311 responder covers main accounts
    return {
      id,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@harbourview.example`,
      department,
      role,
      status: id === 'user-10' ? 'Invited' : 'Active',
      functions: [...ROLE_FUNCTIONS[role]],
      channels,
      adAccounts: [],
    }
  })

  const groups: AssetGroup[] = DEPARTMENTS.map((d, i) => ({
    id: `asset-${i}`,
    name: `Harbourview ${d}`,
    color: GROUP_COLORS[i],
    voice: i === 0 ? 'Clear, approachable, calm and inclusive. Use plain language.' : 'Helpful, practical and respectful. Explain services clearly.',
    assignments: [],
  }))
  // Lily Green (Recreation editor) also creates for two Communications channels through a group role only.
  groups[0].assignments.push({ userId: 'user-21', role: 'creator', channelIds: ['social-0', 'social-6'], adAccountIds: [] })
  // Theo Wright approves for 311 through the Customer Service group.
  groups[4].assignments.push({ userId: 'user-28', role: 'approver', channelIds: ['social-4', 'social-10'], adAccountIds: [] })

  const statusPlan: PostStatus[] = [
    ...Array<PostStatus>(16).fill('Published'),
    ...Array<PostStatus>(8).fill('Scheduled'),
    ...Array<PostStatus>(3).fill('Failed'),
    ...Array<PostStatus>(7).fill('Draft'),
    ...Array<PostStatus>(6).fill('In review'),
    ...Array<PostStatus>(2).fill('Approved'),
  ]
  const posts: Post[] = statusPlan.map((status, i) => {
    const [department, title, text] = POST_TEMPLATES[i % POST_TEMPLATES.length]
    const candidates = accounts.filter((a) => a.department === department)
    const account = candidates[Math.floor(i / POST_TEMPLATES.length) % candidates.length]
    const published = status === 'Published' || status === 'Failed'
    const at = published ? now - (i % 16) * 10 * hour - 2 * hour : null
    const scheduled = status === 'Scheduled' ? now + (6 + (i - 16) * 19) * hour : status === 'Approved' ? now + (3 + i) * day : null
    const author = users.find((u) => u.department === department && u.functions.includes('content.create'))
    return {
      id: `POST-${300 + i}`,
      batchId: `batch-${300 + i}`,
      accountId: account.id,
      title,
      text,
      status,
      photo: i % 5,
      alt: 'Illustrative sample photo, not a Harbourview location.',
      scheduledFor: scheduled ? iso(Math.round(scheduled / (15 * 60_000)) * 15 * 60_000) : null,
      publishedAt: at ? iso(at) : null,
      createdAt: iso(now - (8 + i) * hour),
      createdBy: author?.id ?? 'user-0',
      metrics:
        status === 'Published'
          ? { impressions: 1800 + Math.round(r() * 19000), engagements: 60 + Math.round(r() * 950), trend: 8 + Math.round(r() * 140), observedAt: iso(now - i * 35 * 60_000) }
          : null,
      failureReason: status === 'Failed' ? pick(['Mock provider timeout', 'Token expired before delivery', 'Media rejected by mock validator']) : undefined,
    }
  })

  const responders = (accountId: string) => users.filter((u) => u.status === 'Active' && u.functions.includes('inbox.respond') && u.channels.includes(accountId))
  const conversations: Conversation[] = Array.from({ length: 80 }, (_, i) => {
    const t = CONVERSATION_TEMPLATES[i % CONVERSATION_TEMPLATES.length]
    const candidates = accounts.filter((a) => a.department === t.department && (t.kind === 'Comment' || a.network !== 'YouTube'))
    const account = candidates[i % candidates.length]
    const created = now - Math.round(r() * 7 * day)
    const resolved = i % 4 === 3
    const eligible = responders(account.id)
    const owner = resolved || i % 3 === 0 ? (eligible.length ? pick(eligible).id : null) : null
    const handle = pick(RESIDENT_HANDLES)
    const score = i % 23 === 7 ? null : Math.max(-100, Math.min(100, AI_BASE[t.sentiment] + Math.round((r() - 0.5) * 24)))
    const thread: Conversation['thread'] = [{ id: `m-${i}-0`, from: 'resident', author: `${handle} (fictional)`, text: t.text, at: iso(created) }]
    if (resolved) thread.push({ id: `m-${i}-1`, from: 'staff' as const, author: 'Harbourview staff', text: STAFF_REPLIES[t.category], at: iso(created + 2 * hour) })
    const relatedPost = posts.find((p) => p.accountId === account.id && p.status === 'Published')
    return {
      id: `CONV-${2100 + i}`,
      accountId: account.id,
      kind: t.kind,
      postId: t.kind === 'Comment' ? (relatedPost?.id ?? null) : null,
      author: `${handle} (fictional)`,
      thread,
      createdAt: iso(created),
      status: resolved ? 'Resolved' : 'Open',
      ownerId: owner,
      category: t.category,
      priority: t.category === 'Emergency' ? 'Critical' : t.sentiment === 'Negative' && i % 2 === 0 ? 'High' : 'Normal',
      sentiment: t.sentiment,
      ai: { score, confidence: 0.62 + Math.round(r() * 30) / 100, category: t.category, source: 'Simulated classifier, not a live model' },
      notes: [],
      replyDraft: '',
      resolvedBy: resolved ? owner : null,
    }
  })

  const topics: ListeningTopic[] = TOPICS.map(([name, keywords], i) => ({ id: `topic-${i}`, name, keywords, createdBy: 'user-0', createdAt: iso(now - (20 + i) * day) }))

  const mentions: Mention[] = []
  topics.forEach((topic, ti) => {
    const texts = MENTION_TEXT[ti]
    const count = [26, 22, 18, 24][ti]
    for (let k = 0; k < count; k++) {
      const [text, base] = texts[k % texts.length]
      const [source, network] = SOURCES[(k + ti) % SOURCES.length]
      const daysAgo = ti === 3 ? Math.floor(Math.pow(r(), 2) * 7) : Math.floor(r() * 7)
      mentions.push({
        id: `MEN-${ti}-${k}`,
        topicId: topic.id,
        network,
        source,
        author: source === 'News' ? 'Harbourview Ledger (fictional outlet)' : source === 'Forum' ? 'hv-community forum user (fictional)' : source === 'Blog' ? 'Local blog (fictional)' : `${pick(RESIDENT_HANDLES)} (fictional)`,
        text,
        url: `https://example.org/fictional/${topic.id}/${k}`,
        at: iso(now - daysAgo * day - Math.round(r() * 20) * hour),
        sentiment: Math.max(-100, Math.min(100, base + Math.round((r() - 0.5) * 20))),
      })
    }
  })
  mentions.sort((a, b) => b.at.localeCompare(a.at))

  const alerts: ListeningAlert[] = [
    { id: 'alert-0', topicId: 'topic-3', kind: 'negative', threshold: 60, enabled: true, createdBy: 'user-0', triggeredAt: iso(now - 5 * hour) },
    { id: 'alert-1', topicId: 'topic-0', kind: 'volume', threshold: 8, enabled: true, createdBy: 'user-0', triggeredAt: null },
  ]

  return {
    version: 1,
    seededAt: iso(now),
    users,
    accounts,
    groups,
    posts,
    conversations,
    topics,
    mentions,
    alerts,
    audit: [{ id: 'audit-0', at: iso(now), actor: 'System', action: 'Demo data seeded', detail: 'Fictional Harbourview baseline loaded in this browser.' }],
    feed: [],
    emergency: { paused: false, reason: null, changedAt: null, changedBy: null },
    updateIndex: 0,
  }
}
