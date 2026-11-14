import { getDb } from "@/db/client";
import type { Topic } from "@/modules/platform/outbox";
import { dispatch, handlers } from "./handlers";
import { inngest } from "./inngest-client";
import { relay } from "./relay";
import { nightly, sweep } from "./sweep";

/** Every outbox topic with a real handler becomes a durable, retried Inngest function. */
const eventFunctions = (Object.keys(handlers) as Topic[]).map((topic) =>
  inngest.createFunction(
    { id: `on-${topic.replace(".", "-")}`, triggers: [{ event: topic }] },
    async ({ event, step }) => {
      await step.run("handle", async () => dispatch(await getDb(), topic, event.data));
    },
  ),
);

/** Hold expiry, auto-settle and proposal expiry. */
const sweepFn = inngest.createFunction(
  { id: "sweep", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) =>
    step.run("sweep", async () => {
      const db = await getDb();
      // Also flush the outbox, so an event stuck by a crash reaches Inngest within 5 minutes.
      return { ...(await sweep(db)), relayed: await relay(db) };
    }),
);

/** Nightly matching and ledger reconciliation. */
const nightlyFn = inngest.createFunction(
  { id: "nightly", triggers: [{ cron: "0 3 * * *" }] },
  async ({ step }) => step.run("nightly", async () => nightly(await getDb())),
);

export const functions = [...eventFunctions, sweepFn, nightlyFn];
