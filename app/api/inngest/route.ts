import { serve } from "inngest/next";
import { functions } from "@/jobs/functions";
import { inngest } from "@/jobs/inngest-client";

/** Inngest calls this endpoint to run durable functions; requests are signature-checked by the SDK. */
export const { GET, POST, PUT } = serve({ client: inngest, functions });
