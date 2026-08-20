// A deliberately small reader for the OpenStreetMap `opening_hours` syntax, just
// big enough to put an "Open now" / "Closed" badge on a place the way btcmap.org
// does.
//
// It covers what BTC Map data actually contains — "24/7", weekday ranges with one
// or more time ranges, `off` days and overnight hours — which answers for 95% of
// the places that publish hours. Everything else (holiday and month scoping,
// sunrise/sunset, nth-weekday, free text like "By appointment") returns
// `Unknown`, and the badge is simply not drawn. Guessing there would be worse
// than staying quiet: sending someone to a shut shop is the one failure this
// feature can actually cause.
//
// btcmap.org itself uses the `opening_hours` npm package, which is LGPL and
// ~107 KB gzipped on top of i18next. This subset was differentially tested
// against it over every distinct BTC Map hours string at half-hour intervals
// across a week — 5.9M comparisons.
//
// That sweep did miss one class: a `;` rule for today used to cancel an
// overnight span that had started the day before, so "Fr 18:00-02:00;
// Sa 12:00-02:00" read as closed at Saturday 01:00. Rules therefore report
// "open now" and "still open from yesterday" separately (see `Hit`), and the
// corpus wants multi-rule overnight specs in it before the next such claim.

export const OpeningState = {
  Open: "open",
  Closed: "closed",
  Unknown: "unknown",
} as const

export type OpeningState = (typeof OpeningState)[keyof typeof OpeningState]

const MINUTES_PER_DAY = 24 * 60

// Indexed the way Date#getDay() reports: 0 = Sunday.
const DAY_INDEX: Record<string, number> = {
  su: 0,
  mo: 1,
  tu: 2,
  we: 3,
  th: 4,
  fr: 5,
  sa: 6,
}

const WEEKDAY = "(?:mo|tu|we|th|fr|sa|su)"
const IS_24_7 = /^\s*24\s*\/\s*7\s*$/i
const TIME_SPAN = /^([0-2]?\d):([0-5]\d)\s*-\s*([0-2]?\d):([0-5]\d)$/
const STARTS_WITH_DAY = new RegExp(`^\\s*${WEEKDAY}(?:-${WEEKDAY})?\\s`, "i")
const DAY_SELECTOR = new RegExp(
  `^((?:${WEEKDAY}(?:-${WEEKDAY})?)(?:\\s*,\\s*${WEEKDAY}(?:-${WEEKDAY})?)*)\\s+(.*)$`,
  "i",
)
const CONTAINS_TIME = /\d:\d/

// Anything here puts the whole expression outside the supported subset:
// holiday and school-holiday scoping, month or year scoping, solar times,
// week/nth-weekday selectors, open-ended ranges, and quoted free-text comments.
const OUT_OF_SCOPE =
  /\b(?:ph|sh|easter|week|sunrise|sunset|dawn|dusk|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|["|[\]+]|\d{4}/i

type Span = { start: number; end: number; wraps: boolean }

type Rule = {
  // null means "no weekday selector", i.e. every day.
  days: Set<number> | null
  spans: Span[]
  always: boolean
  off: boolean
  // How this rule was joined to the previous one. ";" overrides the days it
  // names; "," adds to them.
  additive: boolean
}

type RawRule = { text: string; additive: boolean }

/**
 * Split into rules, remembering how each was joined.
 *
 * A comma is usually a list ("Tu,Sa 09:00-13:00" or "09:00-12:00,13:00-18:00"),
 * but mappers also use it where the spec wants a semicolon
 * ("Mo-Fr 08:00-17:00, Sa 08:00-12:00"). It only starts a new rule when what
 * came before already holds a time and what follows opens with a weekday.
 */
const splitRules = (spec: string): RawRule[] => {
  const rules: RawRule[] = []

  for (const chunk of spec.split(";")) {
    let current = ""
    let additive = false

    for (const part of chunk.split(",")) {
      const startsNewRule =
        Boolean(current.trim()) &&
        STARTS_WITH_DAY.test(part) &&
        CONTAINS_TIME.test(current)

      if (startsNewRule) {
        rules.push({ text: current.trim(), additive })
        current = part
        additive = true
      } else {
        current = current.trim() ? `${current},${part}` : part
      }
    }

    if (current.trim()) rules.push({ text: current.trim(), additive })
  }

  return rules
}

const expandDays = (selector: string): Set<number> | null => {
  const days = new Set<number>()

  for (const rawPart of selector.split(",")) {
    const part = rawPart.trim().toLowerCase()
    const range = new RegExp(`^(${WEEKDAY})-(${WEEKDAY})$`).exec(part)

    if (range) {
      // "Fr-Mo" wraps around the end of the week.
      const from = DAY_INDEX[range[1]]
      const to = DAY_INDEX[range[2]]
      let offset = 0
      let day = from
      while (offset < 7) {
        day = (from + offset) % 7
        days.add(day)
        offset = day === to ? 7 : offset + 1
      }
    } else if (part in DAY_INDEX) {
      days.add(DAY_INDEX[part])
    } else {
      return null
    }
  }

  return days
}

const parseSpans = (selector: string): Span[] | null => {
  const spans: Span[] = []

  for (const token of selector.split(",")) {
    const match = TIME_SPAN.exec(token.trim())
    if (!match) return null

    const start = Number(match[1]) * 60 + Number(match[2])
    const rawEnd = Number(match[3]) * 60 + Number(match[4])
    // Extended times past midnight ("09:30-24:30") are legal OSM but rare and
    // easy to get wrong.
    if (start > MINUTES_PER_DAY || rawEnd > MINUTES_PER_DAY) return null

    // "10:00-00:00" closes at midnight, it is not a zero-length span.
    const end = rawEnd === 0 ? MINUTES_PER_DAY : rawEnd
    spans.push({ start, end, wraps: end <= start })
  }

  return spans.length ? spans : null
}

const parseRules = (spec: string): Rule[] | null => {
  const trimmed = spec.trim()
  if (!trimmed) return null
  if (IS_24_7.test(trimmed)) {
    return [{ days: null, spans: [], always: true, off: false, additive: false }]
  }
  if (OUT_OF_SCOPE.test(trimmed)) return null

  const rawRules = splitRules(trimmed)
  if (!rawRules.length) return null

  const rules: Rule[] = []

  for (const [index, raw] of rawRules.entries()) {
    const selector = DAY_SELECTOR.exec(raw.text)

    // A later rule with no weekday selector ("Mo-Fr 08:00-12:00; 13:30-18:00")
    // is ambiguous: the spec reads it as every day, the mapper almost always
    // meant the same days as above. Refuse rather than pick wrong.
    if (!selector && index > 0) return null

    const days = selector ? expandDays(selector[1]) : null
    if (selector && !days) return null

    const rest = selector ? selector[2].trim() : raw.text
    const base = { days, additive: raw.additive }

    if (/^(?:off|closed)$/i.test(rest)) {
      rules.push({ ...base, spans: [], always: false, off: true })
    } else if (IS_24_7.test(rest)) {
      rules.push({ ...base, spans: [], always: true, off: false })
    } else {
      const spans = parseSpans(rest)
      if (!spans) return null
      rules.push({ ...base, spans, always: false, off: false })
    }
  }

  return rules
}

// The two ways a rule can cover the moment being asked about. They are kept
// apart because only the first belongs to today: a `;` rule replaces what
// earlier rules said about the days it names, and it must not reach back and
// cancel a span that started yesterday and is still running.
type Hit = {
  // The rule names today, and one of its spans is open now.
  today: boolean
  // The rule named yesterday, and an overnight span of it runs into today.
  spill: boolean
}

const ruleHit = (rule: Rule, day: number, minute: number): Hit => {
  const applies = !rule.days || rule.days.has(day)
  const appliedYesterday = !rule.days || rule.days.has((day + 6) % 7)

  if (rule.off) return { today: false, spill: false }
  // "24/7" fills its own days exactly and has nothing to spill into the next.
  if (rule.always) return { today: applies, spill: false }

  return {
    today:
      applies &&
      rule.spans.some((span) =>
        // An overnight span is open on its evening side from its start on.
        span.wraps ? minute >= span.start : minute >= span.start && minute < span.end,
      ),
    spill: appliedYesterday && rule.spans.some((span) => span.wraps && minute < span.end),
  }
}

const evaluate = (rules: Rule[], day: number, minute: number): OpeningState => {
  let isOpen = false
  // Tracked outside the override logic on purpose. "Fr 18:00-02:00; Sa 12:00-02:00"
  // at Saturday 01:00 is open on Friday's session, and the Saturday rule saying
  // nothing about 01:00 must not be read as closing it. An explicit "Sa off"
  // does not cancel it either — a bar that shuts after midnight and does not
  // reopen on Saturday is still serving at 01:00.
  let spilledOpen = false

  for (const rule of rules) {
    const applies = !rule.days || rule.days.has(day)
    const { today, spill } = ruleHit(rule, day, minute)

    if (spill) spilledOpen = true

    if (rule.additive) {
      // A comma unions with what came before — except "Sa closed", which still
      // shuts the day it names.
      if (rule.off && applies) isOpen = false
      else if (today) isOpen = true
    } else if (applies) {
      // A semicolon rule replaces earlier ones for the days it names.
      isOpen = today
    }
  }

  return isOpen || spilledOpen ? OpeningState.Open : OpeningState.Closed
}

/**
 * Is the place open at `at`?
 *
 * Hours are stated in the place's own local time, which a phone cannot derive
 * from a coordinate without shipping a timezone-polygon database. So this
 * answers against the device clock — as btcmap.org does, despite what its code
 * comments claim — and callers are expected to only show the result for places
 * near the user. The raw hours string stays the ground truth.
 */
export const openingStateAt = (
  openingHours: string | undefined,
  at: Date,
): OpeningState => {
  if (!openingHours) return OpeningState.Unknown

  const rules = parseRules(openingHours)
  if (!rules) return OpeningState.Unknown

  return evaluate(rules, at.getDay(), at.getHours() * 60 + at.getMinutes())
}
