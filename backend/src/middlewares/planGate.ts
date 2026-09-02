import { NextFunction, Request, Response } from "express";
import SubscriptionRepository from "../DB/repositories/SubscriptionRepository";
import { getLogger, runWithLogger } from "../observability/requestLoggerContext";

export const planGate = async (req: Request, res: Response, next: NextFunction) => {
    const log = getLogger().child({ module: 'authorization', middleware: 'planGate' });

    log.debug({ reqUser: req.user })
    if (!req.user || !req.user.userId) {
        log.info('request is not authenticated')
        return next()
    }

    const subscriptions = await runWithLogger(log, () => (new SubscriptionRepository()).getByStatusForUser(req.user!.userId, ['active', 'trialing']))
    log.debug({ subscription: subscriptions })
    if (subscriptions.length > 1) {
        log.error({ subscriptionsLength: subscriptions.length }, 'Rejected: more than one valid subscription found');
        return res.status(403).json({ error: 'INTERNAL_ERROR', })
    }

    const subscription = subscriptions[0]
    if (subscription && ['active', 'trialing'].includes(subscription.status) && subscription.currentPeriodEnd >= Date.now()) {
        log.info('subscription is valid')
        return next();
    }

    log.info('Rejected: plan state is invalid or expired');

    return res.status(403).json({ error: 'PLAN_STATE_INVALID', message: `You have exceed your plan limitations.`, })
}
