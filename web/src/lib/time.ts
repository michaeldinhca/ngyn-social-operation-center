// Scheduling is shown and entered in America/Halifax, the demo municipality's time zone.
export const TZ = 'America/Halifax'

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const o: Record<string, number> = {}
  for (const p of f.formatToParts(d)) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o
}

const z = (n: number) => String(n).padStart(2, '0')

/** Halifax wall-clock time as 'YYYY-MM-DDTHH:mm' for a datetime-local input. */
export function toHalifaxInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const p = parts(new Date(iso))
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`
}

/** Convert a Halifax wall-clock 'YYYY-MM-DDTHH:mm' to an ISO instant, DST-safe. */
export function halifaxToISO(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m) throw new Error('Choose a date and time.')
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const asUTC = Date.UTC(y, mo - 1, d, h, mi)
  let guess = asUTC
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess))
    guess += asUTC - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  }
  return new Date(guess).toISOString()
}

/** Calendar day key in Halifax, 'YYYY-MM-DD'. */
export function dayKeyHalifax(iso: string | Date): string {
  const p = parts(typeof iso === 'string' ? new Date(iso) : iso)
  return `${p.year}-${z(p.month)}-${z(p.day)}`
}

/** Keep the clock time of an existing instant but move it to another Halifax day. */
export function moveToDay(iso: string | null, dayKey: string, fallbackTime = '10:00'): string {
  const time = iso ? toHalifaxInput(iso).slice(11) : fallbackTime
  return halifaxToISO(`${dayKey}T${time}`)
}
