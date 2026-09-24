import { v, type Validator } from "convex/values";

export const roleValidator = v.union(v.literal("user"), v.literal("admin"));

export const genderValidator = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("other"),
  v.literal("unspecified"),
);

export const formatsValidator = v.union(
  v.literal("singles"),
  v.literal("doubles"),
  v.literal("both"),
);

export const handednessValidator = v.union(v.literal("right"), v.literal("left"));

export const surfaceValidator = v.union(
  v.literal("hard"),
  v.literal("clay"),
  v.literal("grass"),
  v.literal("other"),
);

export const slotStatusValidator = v.union(
  v.literal("open"),
  v.literal("matched"),
  v.literal("cancelled"),
  v.literal("expired"),
);

export const requestStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled"),
);

export const reportReasonValidator = v.union(
  v.literal("harassment"),
  v.literal("inappropriate"),
  v.literal("fake_profile"),
  v.literal("no_show"),
  v.literal("other"),
);

export const reportStatusValidator = v.union(
  v.literal("open"),
  v.literal("reviewed"),
  v.literal("dismissed"),
);

export const notificationTypeValidator = v.union(
  v.literal("request_received"),
  v.literal("request_accepted"),
  v.literal("request_declined"),
  v.literal("new_message"),
);

/** Return validator for `.paginate()` results. Unused until the availability task lists slots. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic validator bound
export function paginated<T extends Validator<any, "required", any>>(item: T) {
  return v.object({
    page: v.array(item),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null()),
    ),
  });
}
