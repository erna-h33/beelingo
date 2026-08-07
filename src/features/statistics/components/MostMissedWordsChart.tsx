import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

/** Structural subset shared by ClassWordStat (0023, one class) and
 * TeacherMostMissedWord (0024, across every class a teacher owns) --
 * this chart only ever needs these four fields, so it accepts either
 * without a cast. */
interface MissedWordLike {
  word: string
  translation: string | null
  attempts: number
  missRate: number
}

interface MostMissedWordsChartProps {
  stats: MissedWordLike[]
}

/** Horizontal bar chart of cumulative miss-rate per word -- deliberately
 * built from game_answers (via the class_word_stats RPC), never from
 * mastery_score, keeping the adaptive engine's internal score fully
 * internal even on the one dashboard where a naive implementation might
 * have been tempted to just surface it directly. */
export function MostMissedWordsChart({ stats }: MostMissedWordsChartProps) {
  if (stats.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Play a few games and this will show which words trip the class up most.
      </p>
    )
  }

  // Recharts renders a vertical-layout category axis top-to-bottom in
  // array order, so the RPC's missRate-desc order (worst first) already
  // puts the most-missed word at the top -- no reversal needed.
  const data = stats.map((s) => ({
    label: s.translation ? `${s.word} → ${s.translation}` : s.word,
    missRatePct: Math.round(s.missRate * 100),
    attempts: s.attempts,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis type="category" dataKey="label" width={140} fontSize={12} stroke="var(--muted-foreground)" />
        <Tooltip
          formatter={(value, _name, item) => [`${value}% missed (${item.payload.attempts} attempts)`, ""]}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--popover-foreground)" }}
        />
        <Bar dataKey="missRatePct" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.missRatePct >= 50 ? "var(--destructive)" : "var(--primary)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
