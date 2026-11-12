import * as Sentry from "@sentry/nextjs";
import { opcionesSentry } from "@/lib/monitoreo";

Sentry.init(opcionesSentry);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
