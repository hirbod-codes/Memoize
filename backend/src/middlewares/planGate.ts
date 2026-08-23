import { NextFunction, Request, Response } from "express";
import SubscriptionRepository from "../DB/repositories/SubscriptionRepository";
import { getLogger } from "../observability/requestContext";

export const planGate = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user)
        return next()

    const log = getLogger().child({ module: 'planGate', userId: req.user.userId });

    let authorized = false

    const subscription = await (new SubscriptionRepository()).getActiveByUserId(req.user.userId)
    if (subscription && subscription.status !== 'canceled' && subscription.currentPeriodEnd >= Date.now())
        authorized = true

    log.debug(
        {
            hasSubscription: !!subscription,
            status: subscription?.status,
            currentPeriodEnd: subscription?.currentPeriodEnd,
            authorized,
        },
        'Evaluated plan gate'
    );

    if (!authorized) {
        log.info('Rejected: plan state invalid or expired');
        return res.status(403).json({
            error: 'PLAN_STATE_INVALID',
            message: `You have exceed your plan limitations.`,
        })
    }

    next();
}
