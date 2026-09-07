import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

export default Alchemy.Stack(
  "tennis-buddy-finder",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const webWorker = yield* Cloudflare.Website.Nuxt("web", {
      rootDir: "../../apps/web",
      env: {
        NUXT_PUBLIC_CONVEX_URL: Config.string("NUXT_PUBLIC_CONVEX_URL"),
      },
      dev: {
        port: 3001,
      },
    });

    return {
      web: webWorker.url,
    };
  }),
);
