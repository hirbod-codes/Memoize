import { Request, Response, NextFunction } from 'express';
import UsageRepository from '../DB/repositories/UsageRepository';
import PlanRepository from '../DB/repositories/PlanRepository';
import { FeatureField, Privileges } from '../DB/models/Plan';
import { Usage, UsageField, resolveQuotaField } from '../DB/models/Usage';
import { getLogger, runWithLogger } from '../observability/requestLoggerContext';

export function authorizeQuota(usages: Map<UsageField, number>): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>
export function authorizeQuota(usages: Map<UsageField, number>, req: Request): Promise<boolean>
export function authorizeQuota(usages: Map<UsageField, number>, req?: Request): Promise<boolean> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>) {
    const log = getLogger().child({ module: 'authorization', middleware: 'authorizeQuota' });

    log.debug({ usages })

    async function temp(req: Request): Promise<boolean> {
        try {
            log.debug({ reqUser: req.user })
            if (!req.user || !req.user.userData || !req.user.userId) {
                log.info('Denied: no authenticated user on request');
                return false;
            }

            const privileges = await runWithLogger(log, () => getPrivileges(req))
            log.debug({ privileges })
            if (!privileges) {
                log.warn({ userId: req.user.userId }, 'Denied: could not resolve plan privileges');
                return false
            }

            const usagesWithLimits = runWithLogger(log, () => collectLimitsForQuotas(usages, privileges))
            log.debug({ usagesWithLimits })

            const reserved = await runWithLogger(log, () => (new UsageRepository()).tryIncrementQuotas(req.user!.userId, usagesWithLimits))
            log.debug({ reserved })
            if (!reserved) {
                log.info('Denied: quota exceeded');
                return false;
            }

            // Stash rollback info in case the handler fails downstream
            req.quotaReservations = req.quotaReservations ?? []
            req.quotaReservations.push({ userId: req.user.userId, usages });
            log.info('Reserved quota for potential rollback');

            log.info('request is authorized');
            return true
        } catch (error) {
            log.error({ err: error }, 'authorizeQuota (direct-call form) threw synchronously');
            return new Promise<boolean>((resolve, reject) => { resolve(false) })
        }
    }

    if (req)
        return temp(req)
    else
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await temp(req)
                if (result !== true) {
                    log.debug({ result })
                    log.info('Request is unauthorized')
                    return res.status(403).json({
                        error_codes: 'QUOTA_EXCEEDED',
                        message: `You've reached your plan's limit for this action.`,
                    });
                }

                log.info('Request is authorized')
                next();
            } catch (error) {
                next(error)
            }
        };
}

function collectLimitsForQuotas(quotas: Map<UsageField, number>, privileges: Privileges): Map<UsageField, { amount: number; limit: number; }> {
    const log = getLogger().child({ step: 'collectLimitsForQuotas' });

    log.debug({ quotas, privileges })

    const newQuotas: Map<UsageField, { amount: number, limit: number }> = new Map()

    for (const [field, amount] of quotas.entries()) {
        const limit = resolveQuotaField(field).includes('.')
            ? (privileges as any)[field.split('.')[0]][field.split('.')[0]]
            : privileges[field as keyof Privileges];

        if (limit === null || limit === undefined)
            throw new Error(`UNDEFINED_PRIVILEGE_QUOTA_LIMIT: ${field}`)

        newQuotas.set(field, { amount, limit })
    }

    log.debug({ newQuotas })
    log.info('Limitations collected')
    return newQuotas
}

export function authorizeFeature(featureFields: FeatureField[]): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>
export function authorizeFeature(featureFields: FeatureField[], req: Request): Promise<boolean>
export function authorizeFeature(featureFields: FeatureField[], req?: Request): Promise<boolean> | ((req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>) {
    const log = getLogger().child({ module: 'authorization', middleware: 'authorizeFeature' });

    log.debug({ featureFields })

    async function temp(req: Request): Promise<boolean> {
        try {
            log.debug({ reqUser: req.user })
            if (!req.user || !req.user.userData || !req.user.userId) {
                log.info('Denied: no authenticated user on request');
                return false
            }

            const privileges = await runWithLogger(log, () => getPrivileges(req))
            log.debug({ privileges })
            if (!privileges) {
                log.warn({ userId: req.user.userId }, 'Denied: could not resolve plan privileges');
                return false
            }

            for (const featureField of featureFields) {
                const isAllowed = featureField.includes('.')
                    ? (privileges as any)[featureField.split('.')[0]][featureField.split('.')[0]]
                    : privileges[featureField as keyof Privileges];

                if (!isAllowed) {
                    log.info({ featureField }, 'Denied: feature not allowed on plan');
                    return false
                }
            }

            log.info('Request is authorized')
            return true
        } catch (err) {
            log.error({ error: err }, 'authorizeFeature (direct-call form) threw');
            return new Promise<boolean>((resolve, reject) => { resolve(false) })
        }
    }

    if (req)
        return temp(req)
    else
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const result = await temp(req)
                if (result !== true) {
                    log.debug({ result })
                    log.info('Request is unauthorized')
                    return res.status(403).json({
                        error_codes: 'QUOTA_EXCEEDED',
                        message: `You've reached your plan's limit for this action.`,
                    });
                }

                log.info('Request is authorized')
                next();
            } catch (error) {
                next(error)
            }
        };
}

export async function getUsage(req: Request): Promise<Usage | undefined> {
    const log = getLogger().child({ module: 'authorization', fn: 'getUsage' });
    try {
        if (!req.user || !req.user.userData)
            return undefined

        if (!req.user.usages) {
            const usages = await (new UsageRepository()).getByUserId(req.user!.userId);
            if (!usages) {
                log.warn({ userId: req.user.userId }, 'No usage record found for user');
                return undefined
            }

            req.user.usages = usages
        }

        return req.user.usages
    } catch (error) {
        log.error({ err: error }, 'Failed to resolve usage');
        return undefined
    }
}

export async function getPrivileges(req: Request): Promise<Privileges | undefined> {
    const log = getLogger().child({ step: 'getPrivileges' });

    try {
        log.debug({ reqUser: req.user })
        if (!req.user || !req.user.userData) {
            log.info('Unauthenticated request')
            return undefined
        }

        if (!req.user.privileges) {
            const userPlan = await runWithLogger(log, () => (new PlanRepository()).getByTitle(req.user!.userData.planTitle))
            log.debug({ userPlan })
            if (!userPlan) {
                log.error("No plan found matching user's planTitle");
                return undefined
            }

            req.user.privileges = userPlan.privileges
        }

        log.info("Matching plan for user's planTitle has been found");
        return req.user.privileges
    } catch (error) {
        log.error({ err: error }, 'Failed to resolve privileges');
        return undefined
    }
}

export async function rollbackQuota(usages: Map<UsageField, number>, req: Request): Promise<boolean> {
    const log = getLogger().child({ step: 'rollbackQuota' });

    log.debug({ usages: Object.fromEntries(usages) })

    const privileges = await runWithLogger(log, () => getPrivileges(req))
    log.debug({ privileges })
    if (!privileges) {
        log.warn({ userId: req.user?.userId }, 'Could not roll back quota: privileges unresolved');
        return false
    }

    const reserved = await runWithLogger(log, () => (new UsageRepository()).decrementQuotas(req.user!.userId, usages))
    log.debug({ decrementQuotasResult: reserved })
    if (!reserved.acknowledged) {
        log.error({ userId: req.user!.userId, usages: Object.fromEntries(usages) }, 'Quota rollback not acknowledged by DB');
        return false
    }

    log.info('Rolled back quota');
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
        const log = getLogger().child({ step: 'rollbackQuotaOnFailure' });

        if (handled) {
            log.info('rollback is already being handled, returning')
            return;
        }
        handled = true;

        const isFailure = aborted || res.statusCode < 200 || res.statusCode >= 300;
        if (!isFailure) {
            log.info('response has not failed, returning')
            return;
        }

        const reservations = req.quotaReservations;
        if (!reservations || reservations.length === 0) {
            log.info('there is no reserved quota to rollback, returning')
            return;
        }

        log.debug({ statusCode: res.statusCode, aborted, reservationCount: reservations.length })
        log.info('Rolling back quota reservations after failed response')

        await Promise.allSettled(
            reservations.map((r) =>
                runWithLogger(log, () => rollbackQuota(r.usages, req))
                    .catch((err) => {
                        log.error({ err, userId: r.userId, usages: r.usages }, 'Failed to rollback quota');
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
