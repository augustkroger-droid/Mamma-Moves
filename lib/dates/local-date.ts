export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key: string, amount: number) {
  const date = parseLocalDateKey(key);
  date.setDate(date.getDate() + amount);

  return localDateKey(date);
}

export function eachDateInRange(startKey: string, endKey: string) {
  const dates: string[] = [];
  let cursor = startKey;

  while (cursor <= endKey && dates.length < 370) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}
