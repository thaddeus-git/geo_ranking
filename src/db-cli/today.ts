import { cmdList } from './list.ts';
import { localToday } from '../db/date.ts';

export async function cmdToday(flags: Record<string, string | boolean>): Promise<void> {
  await cmdList({ ...flags, date: localToday() });
}
