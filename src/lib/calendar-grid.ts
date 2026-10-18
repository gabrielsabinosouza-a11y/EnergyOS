export function getCalendarMonthCells(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatCalendarMonth(year: number, month: number): string {
  const text = new Date(Date.UTC(year, month, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return `${text.charAt(0).toLocaleUpperCase("pt-BR")}${text.slice(1)}`;
}
