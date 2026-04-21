import { hasRunToday } from '../db/runs.ts';

export async function cmdHasToday(flags: Record<string, string | boolean>): Promise<boolean> {
  const kw = flags.keyword;
  if (typeof kw !== 'string' || !kw) {
    console.error('has-today requires --keyword "<text>"');
    process.exit(2);
  }
  const platform = typeof flags.platform === 'string' ? flags.platform : 'doubao';
  return hasRunToday(kw, platform);
}
