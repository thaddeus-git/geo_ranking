import { brandHistory } from '../db/runs.ts';

export async function cmdBrandHistory(name: string | undefined, flags: Record<string, string | boolean>): Promise<void> {
  if (!name) {
    console.error('brand-history requires a positional <name> argument');
    process.exit(2);
  }
  const rows = brandHistory(name);
  if (flags.json) {
    console.log(JSON.stringify(rows));
    return;
  }
  for (const r of rows) {
    console.log(`${r.date}\t#${r.rank}\t${r.pack}\t${r.query}`);
  }
}
