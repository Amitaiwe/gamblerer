import { neon } from '@neondatabase/serverless';

// Aggregate-only global counters. No player IDs, no per-game rows.
// The report (3 numbers) is folded into a single counters row and discarded.

const ENSURE = `
CREATE TABLE IF NOT EXISTS global_stats (
  id smallint PRIMARY KEY DEFAULT 1,
  games numeric NOT NULL DEFAULT 0,
  stations_sum numeric NOT NULL DEFAULT 0,
  stations_max numeric NOT NULL DEFAULT 0,
  peak_sum numeric NOT NULL DEFAULT 0,
  peak_max numeric NOT NULL DEFAULT 0,
  allins_sum numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false }); }
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return res.status(400).json({ ok: false });
  }
  const ALLOWED = ['stations', 'peak', 'allins'];
  if (Object.keys(body).some((k) => !ALLOWED.includes(k))) {
    return res.status(400).json({ ok: false });
  }
  const { stations, peak, allins } = body;
  const nonNeg = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  const shapeOk =
    nonNeg(stations) && Number.isInteger(stations) &&
    nonNeg(peak) &&
    nonNeg(allins) && Number.isInteger(allins);
  if (!shapeOk) {
    return res.status(400).json({ ok: false });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql.query(ENSURE);
    await sql`
      INSERT INTO global_stats (id, games, stations_sum, stations_max, peak_sum, peak_max, allins_sum)
      VALUES (1, 1, ${stations}, ${stations}, ${peak}, ${peak}, ${allins})
      ON CONFLICT (id) DO UPDATE SET
        games        = global_stats.games + 1,
        stations_sum = global_stats.stations_sum + ${stations},
        stations_max = GREATEST(global_stats.stations_max, ${stations}),
        peak_sum     = global_stats.peak_sum + ${peak},
        peak_max     = GREATEST(global_stats.peak_max, ${peak}),
        allins_sum   = global_stats.allins_sum + ${allins},
        updated_at   = now()
    `;
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false });
  }
}
