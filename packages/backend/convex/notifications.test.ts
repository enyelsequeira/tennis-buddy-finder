import { describe, expect, it } from "vitest";

import { api } from "./_generated/api";
import { createNotification } from "./model/notifications";
import { createUser, setup } from "./test.helpers";

describe("notifications", () => {
  it("lists unread for me only, newest first, and marks all read", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    await t.run(async (ctx) => {
      await createNotification(ctx, { userId: a.userId, type: "request_received" });
      await createNotification(ctx, { userId: a.userId, type: "new_message" });
      await createNotification(ctx, { userId: b.userId, type: "request_accepted" });
    });
    const unread = await a.as.query(api.notifications.unread, {});
    expect(unread.map((n) => n.type)).toEqual(["new_message", "request_received"]);
    await a.as.mutation(api.notifications.markAllRead, {});
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
    expect(await b.as.query(api.notifications.unread, {})).toHaveLength(1);
  });

  it("markRead only touches my own notification", async () => {
    const t = setup();
    const a = await createUser(t);
    const b = await createUser(t);
    const id = await t.run(async (ctx) =>
      createNotification(ctx, { userId: a.userId, type: "request_received" }),
    );
    await expect(b.as.mutation(api.notifications.markRead, { notificationId: id })).rejects.toThrow(
      "FORBIDDEN",
    );
    await a.as.mutation(api.notifications.markRead, { notificationId: id });
    expect(await a.as.query(api.notifications.unread, {})).toHaveLength(0);
  });
});
