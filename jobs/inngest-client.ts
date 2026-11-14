import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "skillswap" });
export const inngestEnabled = () => Boolean(process.env.INNGEST_EVENT_KEY) || process.env.INNGEST_DEV === "1";
