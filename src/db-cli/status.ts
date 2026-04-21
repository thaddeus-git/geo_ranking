import { counts } from '../db/runs.ts';
import { listKeywords } from '../db/keywords.ts';

export async function cmdStatus(flags: Record<string, string | boolean>): Promise<void> {
  const c = counts();
  const activeKeywords = listKeywords().length;
  const payload = { ...c, active_keywords: activeKeywords };
  if (flags.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log(`runs:            ${c.runs}`);
  console.log(`today:           ${c.today}`);
  console.log(`distinct keywords (historical): ${c.keywords}`);
  console.log(`distinct brands:  ${c.brands}`);
  console.log(`active keywords: ${activeKeywords}`);
}
