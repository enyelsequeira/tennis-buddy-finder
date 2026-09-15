import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { setup } from "./test.helpers";

describe("healthCheck", () => {
  it("returns OK", async () => {
    const t = setup();
    expect(await t.query(api.healthCheck.get, {})).toBe("OK");
  });
});
