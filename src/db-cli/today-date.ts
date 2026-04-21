import { localToday } from '../db/date.ts';

export async function cmdTodayDate(): Promise<void> {
  console.log(localToday());
}
