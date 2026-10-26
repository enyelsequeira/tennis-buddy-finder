import { describe, expect, test } from "vitest";
import { unreadBadge } from "./unreadBadge";

describe("unreadBadge", () => {
  test("shows the count up to 9", () => {
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(9)).toBe("9");
  });

  test("caps at 9+", () => {
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(42)).toBe("9+");
  });
});
