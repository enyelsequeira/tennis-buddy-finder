import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { isBlockedEitherWay } from "./model/blocks";
import { createUser, setup } from "./test.helpers";

describe("blocks", () => {
  it("block is idempotent and visible in listMine", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    const mine = await a.as.query(api.blocks.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]?.userId).toBe(b.userId);
    await t.run(async (ctx) => {
      expect(await isBlockedEitherWay(ctx, a.userId, b.userId)).toBe(true);
      expect(await isBlockedEitherWay(ctx, b.userId, a.userId)).toBe(true);
    });
  });

  it("cannot block yourself", async () => {
    const t = setup();
    const a = await createUser(t);
    await expect(a.as.mutation(api.blocks.block, { userId: a.userId })).rejects.toThrow(
      "CANNOT_BLOCK_SELF",
    );
  });

  it("unblock removes the block", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await a.as.mutation(api.blocks.unblock, { userId: b.userId });
    expect(await a.as.query(api.blocks.listMine, {})).toHaveLength(0);
  });

  it("hides profiles in both directions", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await a.as.mutation(api.blocks.block, { userId: b.userId });
    await expect(a.as.query(api.profiles.getByUserId, { userId: b.userId })).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(b.as.query(api.profiles.getByUserId, { userId: a.userId })).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
