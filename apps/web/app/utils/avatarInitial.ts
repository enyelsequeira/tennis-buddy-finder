/** First letter or digit of a display name, ignoring markup, so "<b>Ana</b>" shows "A" and not "<". */
export function avatarInitial(name: string) {
  return (
    name
      .replace(/<[^>]*>/g, "")
      .match(/[\p{L}\p{N}]/u)?.[0]
      .toUpperCase() ?? "?"
  );
}
