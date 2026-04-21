import { cmdList } from './list.ts';

export async function cmdToday(flags: Record<string, string | boolean>): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await cmdList({ ...flags, date: today });
}
