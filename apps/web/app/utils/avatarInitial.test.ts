import { describe, expect, test } from "vitest";
import { avatarInitial } from "./avatarInitial";

describe("avatarInitial", () => {
  test("skips markup and takes the first letter", () => {
    expect(avatarInitial("<b>Lane2 B</b> 🎾")).toBe("L");
  });

  test("ignores letters inside a tag", () => {
    expect(avatarInitial("<img src=x onerror=alert(1)>C")).toBe("C");
  });

  test("plain name", () => {
    expect(avatarInitial("Ana")).toBe("A");
  });

  test("lowercase name is uppercased", () => {
    expect(avatarInitial("ana")).toBe("A");
  });

  test("digits count", () => {
    expect(avatarInitial("123")).toBe("1");
  });

  test("no letter or digit falls back to ?", () => {
    expect(avatarInitial("🎾")).toBe("?");
    expect(avatarInitial("")).toBe("?");
  });
});
