import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { ChartPoint } from './useDashboardStats'

/** Chart colours, matching the app's brand and "sortie" orange. */
const IN_COLOUR = '#287a76'
const OUT_COLOUR = '#d97706'
const GRID_COLOUR = '#e7e5e4'

const CHART_HEIGHT = 280

/**
 * Entrées / sorties, in a module of its own so the dashboard can show its
 * figures while recharts — the largest file in the build — is still being
 * parsed on a slow PC.
 *
 * The bars do not animate: recharts animates in JavaScript, frame by frame,
 * and redid it on every new snapshot — a second of busy CPU each time another
 * till rang a sale.
 */
export default function DashboardChart({
  data,
  interval,
  symbol,
  inLabel,
  outLabel,
}: {
  data: ChartPoint[]
  interval: number
  symbol: string
  inLabel: string
  outLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOUR} />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={interval} />
        <YAxis tick={{ fontSize: 12 }} width={44} />
        <Tooltip
          isAnimationActive={false}
          formatter={(value) => `${Number(value).toLocaleString('fr-TN')} ${symbol}`}
        />
        <Legend />
        <Bar
          dataKey="in"
          name={inLabel}
          fill={IN_COLOUR}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="out"
          name={outLabel}
          fill={OUT_COLOUR}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
