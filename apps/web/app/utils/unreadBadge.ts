export function unreadBadge(count: number) {
  return count > 9 ? "9+" : String(count);
}
