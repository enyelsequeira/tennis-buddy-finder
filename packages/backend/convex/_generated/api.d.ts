/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as blocks from "../blocks.js";
import type * as devSeed from "../devSeed.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as matchRequests from "../matchRequests.js";
import type * as model_auth from "../model/auth.js";
import type * as model_blocks from "../model/blocks.js";
import type * as model_conversations from "../model/conversations.js";
import type * as model_errors from "../model/errors.js";
import type * as model_notifications from "../model/notifications.js";
import type * as model_playerCard from "../model/playerCard.js";
import type * as model_profileSchema from "../model/profileSchema.js";
import type * as model_requests from "../model/requests.js";
import type * as model_time from "../model/time.js";
import type * as model_users from "../model/users.js";
import type * as model_validators from "../model/validators.js";
import type * as notifications from "../notifications.js";
import type * as profiles from "../profiles.js";
import type * as users from "../users.js";
import type * as venues from "../venues.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  availability: typeof availability;
  blocks: typeof blocks;
  devSeed: typeof devSeed;
  healthCheck: typeof healthCheck;
  http: typeof http;
  matchRequests: typeof matchRequests;
  "model/auth": typeof model_auth;
  "model/blocks": typeof model_blocks;
  "model/conversations": typeof model_conversations;
  "model/errors": typeof model_errors;
  "model/notifications": typeof model_notifications;
  "model/playerCard": typeof model_playerCard;
  "model/profileSchema": typeof model_profileSchema;
  "model/requests": typeof model_requests;
  "model/time": typeof model_time;
  "model/users": typeof model_users;
  "model/validators": typeof model_validators;
  notifications: typeof notifications;
  profiles: typeof profiles;
  users: typeof users;
  venues: typeof venues;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
