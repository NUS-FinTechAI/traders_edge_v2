export interface HeatCell {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface Heatmap {
  /** One column per week, Monday first; days after `today` are null. */
  columns: (HeatCell | null)[][]
  months: { column: number; label: string }[]
  activeDays: number
}

const DAY = 86_400_000
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`)
}

function toDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** Lay out daily activity counts as a weeks × weekdays grid ending today. */
export function buildHeatmap(
  days: { date: string; count: number }[],
  weeks: number,
  today: string,
): Heatmap {
  const counts = new Map(days.map((day) => [day.date, day.count]))
  const end = toTime(today)
  const weekday = (new Date(end).getUTCDay() + 6) % 7
  const start = end - ((weeks - 1) * 7 + weekday) * DAY
  let max = 0
  for (let time = start; time <= end; time += DAY)
    max = Math.max(max, counts.get(toDate(time)) ?? 0)

  const columns: (HeatCell | null)[][] = []
  const months: Heatmap['months'] = []
  let activeDays = 0
  for (let column = 0; column < weeks; column++) {
    const cells: (HeatCell | null)[] = []
    for (let row = 0; row < 7; row++) {
      const time = start + (column * 7 + row) * DAY
      if (time > end) {
        cells.push(null)
        continue
      }
      const date = toDate(time)
      const count = counts.get(date) ?? 0
      if (count > 0) activeDays++
      const level = count
        ? (Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as
            1 | 2 | 3 | 4)
        : 0
      cells.push({ date, count, level })
    }
    const month = new Date(start + column * 7 * DAY).getUTCMonth()
    const previous =
      column > 0 ? new Date(start + (column - 1) * 7 * DAY).getUTCMonth() : -1
    if (month !== previous) months.push({ column, label: MONTHS[month] })
    columns.push(cells)
  }
  return { columns, months, activeDays }
}
