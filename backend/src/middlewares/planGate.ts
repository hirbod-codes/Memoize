import { NextFunction, Request, Response } from "express";
import { UserRepository } from "../DB/repositories/UserRepository";
import UsageRepository from "../DB/repositories/UsageRepository";
import SubscriptionRepository from "../DB/repositories/SubscriptionRepository";

export const planGate = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user)
        return res.status(401).send();

    const user = await (new UserRepository()).get(req.user.userId)
    if (!user)
        return res.status(401).send();

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
