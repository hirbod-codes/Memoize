import { Request, Response, NextFunction } from 'express';
import UsageRepository from '../DB/repositories/UsageRepository';
import PlanRepository from '../DB/repositories/PlanRepository';
import { FeatureField, Privileges, resolveQuotaField } from '../DB/models/Plan';
import { Usage, UsageField } from '../DB/models/Usage';

export function authorizeQuota(usages: Map<UsageField, number>): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>
export function authorizeQuota(usages: Map<UsageField, number>, req: Request): Promise<boolean>
export function authorizeQuota(usages: Map<UsageField, number>, req?: Request): Promise<boolean> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>) {
    async function temp(req: Request): Promise<boolean> {
        if (!req.user || !req.user.userData || !req.user.userId)
            return false;

        const privileges = await getPrivileges(req)
        if (!privileges)
            return false

        const usagesWithLimits = collectLimitsForQuotas(usages, privileges)

        const reserved = await (new UsageRepository()).tryIncrementQuotas(req.user!.userId, usagesWithLimits);
        if (!reserved)
            return false;

        // Stash rollback info in case the handler fails downstream
        req.quotaReservations = req.quotaReservations ?? []
        req.quotaReservations.push({ userId: req.user.userId, usages });

        return true
    }

    if (req)
        try {
            return temp(req)
        } catch (error) {
            return new Promise<boolean>((resolve, reject) => { resolve(false) })
        }
    else
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await temp(req)
                if (result !== true)
                    return res.status(403).json({
                        error: 'QUOTA_EXCEEDED',
                        message: `You've reached your plan's limit for this.`,
                    });

                next();
            } catch (error) {
                next(error)
            }
        };
}

function collectLimitsForQuotas(quotas: Map<UsageField, number>, privileges: Privileges): Map<UsageField, { amount: number; limit: number; }> {
    const newQuotas: Map<UsageField, { amount: number, limit: number }> = new Map()

    for (const [field, amount] of quotas.entries()) {
        const limit = resolveQuotaField(field).includes('.')
            ? (privileges as any)[field.split('.')[0]][field.split('.')[0]]
            : privileges[field as keyof Privileges];

        if (limit === null || limit === undefined)
            throw new Error('UNDEFINED_PRIVILEGE_QUOTA_LIMIT')

        newQuotas.set(field, { amount, limit })
    }

    return newQuotas
}

export function authorizeFeature(featureFields: FeatureField[]): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>
export function authorizeFeature(featureFields: FeatureField[], req: Request): Promise<boolean>
export function authorizeFeature(featureFields: FeatureField[], req?: Request): Promise<boolean> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>) {
    async function temp(req: Request): Promise<boolean> {
        if (!req.user || !req.user.userData || !req.user.userId)
            return false

        const privileges = await getPrivileges(req)
        if (!privileges)
            return false

        for (const featureField of featureFields) {
            const isAllowed = featureField.includes('.')
                ? (privileges as any)[featureField.split('.')[0]][featureField.split('.')[0]]
                : privileges[featureField as keyof Privileges];

            if (!isAllowed)
                return false
        }

        return true
    }

    if (req)
        return temp(req)
    else
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await temp(req)
                if (result !== true)
                    return res.status(403).json({
                        error: 'QUOTA_EXCEEDED',
                        message: `You've reached your plan's limit for this.`,
                    });

                next();
            } catch (error) {
                next(error)
            }
        };
}

export async function getUsage(req: Request): Promise<Usage | undefined> {
    try {
        if (!req.user || !req.user.userData)
            return undefined

        if (!req.user.usages) {
            const usages = await (new UsageRepository()).getByUserId(req.user!.userId);
            if (!usages)
                return undefined

            req.user.usages = usages
        }

        return req.user.usages
    } catch (error) {
        console.error(error);
        return undefined
    }
}

export async function getPrivileges(req: Request): Promise<Privileges | undefined> {
    try {
        if (!req.user || !req.user.userData)
            return undefined

        if (!req.user.privileges) {
            const userPlan = await (new PlanRepository()).getByTitle(req.user.userData.planTitle)
            if (!userPlan)
                return undefined

            req.user.privileges = userPlan.privileges
        }

        return req.user.privileges
    } catch (error) {
        console.error(error);
        return undefined
    }
}

export async function rollbackQuota(usages: Map<UsageField, number>, req: Request): Promise<boolean> {
    const privileges = await getPrivileges(req)
    if (!privileges)
        return false

    const reserved = await (new UsageRepository()).decrementQuotas(req.user!.userId, usages);
    if (!reserved.acknowledged)
        return false

    return true
}

/**
 * Mount this once, globally, before your routers. Watches every response
 * and rolls back any quota reservations made during the request if the
 * final status isn't 2xx — including client-aborted connections, which
 * never get a real status code written.
 */
export function rollbackQuotaOnFailure(req: Request, res: Response, next: NextFunction) {
    let handled = false;

    const maybeRollback = async (aborted: boolean) => {
        if (handled) return;
        handled = true;

        const isFailure = aborted || res.statusCode < 200 || res.statusCode >= 300;
        if (!isFailure) return;

        const reservations = req.quotaReservations;
        if (!reservations || reservations.length === 0) return;

        await Promise.allSettled(
            reservations.map((r) =>
                rollbackQuota(r.usages, req)
                    .catch((err) => {
                        console.error(`Failed to rollback quota for user ${r.userId}:`, err);
                    })
            )
        );
    };

    // Normal completion — check the actual status code.
    res.once('finish', () => { void maybeRollback(false); });
    // Client disconnected before the response finished (e.g. an aborted
    // upload) — res.statusCode may still be the default 200 here even
    // though nothing was actually delivered, so treat this as a failure
    // unconditionally when the response never completed.
    res.once('close', () => { void maybeRollback(!res.writableEnded); });

    next();
}