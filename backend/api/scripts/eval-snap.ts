// Snap extraction accuracy per platform and field. Needs a configured LLM.
//
//   node --env-file=../.env scripts/eval-snap.ts ../private_data/snap
//
// The folder holds real, consented screenshots plus labels.json:
//   { "grab-1.png": { "platform": "grab", "gross_rm": 812.5, "commission_rm": null, "incentives_rm": 40,
//                     "tips_rm": null, "trips": 61, "hours_online": 44 } }
// A field counts as right when it matches the label (money to the sen; null must stay null).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanImage, extract } from '../src/llm/snap.ts'

const FIELDS = ['gross_rm', 'commission_rm', 'incentives_rm', 'tips_rm', 'trips', 'hours_online'] as const
type Label = { platform: string } & Record<(typeof FIELDS)[number], number | null>

const dir = process.argv[2] ?? '../private_data/snap'
const labels = JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')) as Record<string, Label>
const score: Record<string, Record<string, [right: number, total: number]>> = {}

for (const [file, label] of Object.entries(labels)) {
  const { out } = await extract(await cleanImage(readFileSync(join(dir, file))), [label.platform])
  const got = out.weeks[0]
  const row = (score[label.platform] ??= {})
  for (const f of FIELDS) {
    const want = label[f]
    const have = got ? got[f] : null
    const right = want === null ? have === null : have !== null && Math.abs(have - want) < 0.005
    const cell = (row[f] ??= [0, 0])
    cell[0] += Number(right)
    cell[1] += 1
  }
  console.error(`${file}: done`)
}

for (const [platform, fields] of Object.entries(score)) {
  console.log(`\n${platform} (${fields.gross_rm?.[1] ?? 0} screenshots)`)
  for (const [f, [right, total]] of Object.entries(fields)) console.log(`  ${f.padEnd(14)} ${((100 * right) / total).toFixed(0)}%  (${right}/${total})`)
}
