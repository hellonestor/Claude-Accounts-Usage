export function bar(pct, width = 10) {
  if (pct == null || Number.isNaN(pct)) return '·'.repeat(width)
  const n = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}

export function fmtReset(iso) {
  if (!iso) return '—'
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`
}

export function color(pct) {
  if (pct == null) return s => s
  const code = pct >= 85 ? 31 : pct >= 70 ? 33 : 32
  return s => `\x1b[${code}m${s}\x1b[0m`
}

export function renderTable(rows) {
  const headers = ['LABEL', 'EMAIL', '5H', '7D', 'OPUS', 'SONNET', 'EXTRA']
  const out = []
  out.push(headers.map((h, i) => h.padEnd([12, 30, 22, 22, 6, 6, 14][i])).join(' '))
  for (const r of rows) {
    if (r.error) {
      out.push(`${r.label.padEnd(12)} ${(r.email || '').padEnd(30)} ERROR: ${r.error}`)
      continue
    }
    const c5 = color(r.five_hour), c7 = color(r.seven_day)
    out.push([
      r.label.padEnd(12),
      (r.email || '').padEnd(30),
      c5(`${bar(r.five_hour)} ${String(r.five_hour ?? '-').padStart(3)}% ${fmtReset(r.five_hour_resets).padStart(6)}`),
      c7(`${bar(r.seven_day)} ${String(r.seven_day ?? '-').padStart(3)}% ${fmtReset(r.seven_day_resets).padStart(6)}`),
      String(r.seven_day_opus ?? '-').padStart(4) + '%',
      String(r.seven_day_sonnet ?? '-').padStart(4) + '%',
      r.extra_limit ? `${r.extra_used}/${r.extra_limit}`.padEnd(14) : '-'.padEnd(14),
    ].join(' '))
  }
  return out.join('\n')
}
