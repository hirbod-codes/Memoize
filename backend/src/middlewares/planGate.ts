import { NextFunction, Request, Response } from "express";
import SubscriptionRepository from "../DB/repositories/SubscriptionRepository";

export const planGate = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user)
        return next()

    let authorized = false

    const subscription = await (new SubscriptionRepository()).getActiveByUserId(req.user.userId)
    if (subscription && subscription.status !== 'canceled' && subscription.currentPeriodEnd >= Date.now())
        authorized = true

    if (!authorized)
        return res.status(403).json({
            error: 'PLAN_STATE_INVALID',
            message: `You have exceed your plan limitations.`,
        })

    next();
}
