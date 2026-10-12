// Fails the build if any hand fix in scripts/overrides.json is not in effect.
import fs from 'node:fs'
const root = new URL('..', import.meta.url).pathname
const ov = JSON.parse(fs.readFileSync(root + 'scripts/overrides.json', 'utf8'))
const meta = JSON.parse(fs.readFileSync(root + 'src/data/songs.json', 'utf8')); const byId = Object.fromEntries(meta.map(m => [m.id, m]))
const errs = []
for (const r of ov.remove) { if (byId[r]) errs.push(`removed entry still in songs.json: ${r}`); if (fs.existsSync(`${root}public/songs/${r}.json`)) errs.push(`removed song file still present: ${r}`) }
for (const [id, fields] of Object.entries(ov.meta)) for (const [k, v] of Object.entries(fields)) if (JSON.stringify(byId[id]?.[k]) !== JSON.stringify(v)) errs.push(`override not applied: ${id}.${k}`)
for (const f of ov.pinnedFiles) if (fs.readFileSync(`${root}public/songs/${f}.json`, 'utf8') !== fs.readFileSync(`${root}scripts/overrides/${f}.json`, 'utf8')) errs.push(`pinned song file differs: ${f}`)
for (const t of ov.textFixes) { if (fs.readFileSync(`${root}public/songs/${t.song}.json`, 'utf8').includes(t.find) || JSON.stringify(byId[t.song] ?? {}).includes(t.find)) errs.push(`text fix not applied: ${t.song} "${t.find}"`) }
if (ov.tagShuffle) for (const [id, n] of Object.entries(ov.shuffleBars ?? {})) { const d = JSON.parse(fs.readFileSync(`${root}public/songs/${id}.json`, 'utf8')); const c = d.sections.flatMap(s => s.bars).filter(b => b._feel).length; if (c !== n) errs.push(`shuffle markings missing: ${id} has ${c}/${n}`) }
if (errs.length) { console.error('OVERRIDES CHECK FAILED\n' + errs.join('\n')); process.exit(1) }
console.log(`overrides ok (${Object.keys(ov.meta).length} songs patched, ${ov.remove.length} removed, ${ov.pinnedFiles.length} pinned, ${Object.keys(ov.shuffleBars ?? {}).length} shuffle-tagged)`)
