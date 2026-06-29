import { logger } from "@/infra/logging";

import type { RequestContext } from "@/shared";

export function createRequestLogger(context: RequestContext): typeof logger {
  return logger.child({
    requestId: context.requestId,
    correlationId: context.correlationId,
  });
}
