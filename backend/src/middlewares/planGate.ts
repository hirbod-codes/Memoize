import { NextFunction, Request, Response } from "express";
import SubscriptionRepository from "../DB/repositories/SubscriptionRepository";
import { getLogger, runWithLogger } from "../observability/requestLoggerContext";

export const subscriptionGate = async (req: Request, res: Response, next: NextFunction) => {
    const log = getLogger().child({ module: 'authorization', middleware: 'subscriptionGate' });

    log.debug({ reqUser: req.user })
    if (!req.user || !req.user.userId) {
        log.info('request is not authenticated')
        next()
        return
    }

    const subscriptions = await runWithLogger(log, () => (new SubscriptionRepository()).getActiveByUserId(req.user!.userId))
    log.debug({ subscription: subscriptions })
    if (subscriptions.length > 1) {
        log.error({ subscriptionsLength: subscriptions.length }, 'Rejected: more than one valid subscription found');
        return res.status(403).json({ success: 'error', error_code: 'INTERNAL_ERROR', })
    }

    const subscription = subscriptions[0]
    if (subscription && subscription.currentPeriodEnd && subscription.currentPeriodEnd >= Date.now()) {
        log.info('subscription is valid')
        req.user.privileges = subscription.privileges
        req.user.planTitle = subscription.planTitle
        next()
        return
    }

    log.info('Rejected: subscription state is invalid or expired');
    return res.status(402).json({ success: 'error', error_code: 'SUBSCRIPTION_STATE_INVALID' })
}
