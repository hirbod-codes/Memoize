import { Request, Response } from 'express';
import { getLogger, runWithLogger } from '../observability/requestLoggerContext';
import TreeNodeRepository from '../DB/repositories/TreeNodeRepository';
import LeafRepository from '../DB/repositories/LeafRepository';
import { Privileges } from '../DB/models/Plan';
import UsageRepository from '../DB/repositories/UsageRepository';
import { Usage } from '../DB/models/Usage';

export async function authorizeStorageQuota(req: Request, bytes: number, usage?: Usage, res?: Response) {
    const log = getLogger().child({ step: 'authorizeStorageQuota' });

    try {
        log.debug({ reqUser: req.user, bytes })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(401).json({ status: 'error', error_code: 'UNAUTHENTICATED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        const maxTotalStorageBytes = req.user!.privileges!.storageBytes;
        log.debug({ maxTotalStorageBytes }, 'Resolved plan storage limit');

        const usageRepository = new UsageRepository()

        const usageUpdateResult = await runWithLogger(log, () => usageRepository.tryIncrementStorageQuota(req.user!.userId, bytes, maxTotalStorageBytes))
        log.debug({ usageUpdateResult })
        if (!usageUpdateResult) {
            log.info({ bytes }, 'Rejected video upload: exceeds plan storage limit')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Storage quota authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeStorageQuota function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}

export async function rollbackStorageQuota(req: Request, bytes: number) {
    const log = getLogger().child({ step: 'authorizeStorageQuota' });

    try {
        log.debug({ reqUser: req.user, bytes })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return false
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return false
        }

        const usageRepository = new UsageRepository()

        await runWithLogger(log, () => usageRepository.decrementStorageQuota(req.user!.userId, bytes))

        return true
    } catch (err) {
        log.error({ err }, 'failed to decrement user usage')
        return false
    }
}

/**
 * 
 * @param req 
 * @param level 
 * @param categoriesToAdd 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @param categoriesPerNestedLevelCount 
 * @returns 
 */
export async function authorizeCategoriesPerNestedLevel(req: Request, level: number, categoriesToAdd: number, res?: Response, categoriesPerNestedLevelCount?: number): Promise<boolean | Response<any, Record<string, any>>> {
    const log = getLogger().child({ step: 'authorizeCategoriesPerNestedLevel' });

    try {
        log.debug({ reqUser: req.user })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        const tr = new TreeNodeRepository

        categoriesPerNestedLevelCount = categoriesPerNestedLevelCount ?? await runWithLogger(log, () => tr.countCategoriesPerNestedLevelForUser(req.user!.userId, level))
        log.debug({ categoriesPerNestedLevelCount })

        if (typeof categoriesPerNestedLevelCount === 'number' && (categoriesPerNestedLevelCount + categoriesToAdd) >= req.user.privileges.categoriesPerNestedLevel) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeCategoriesPerNestedLevel function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}

/**
 * 
 * @param req 
 * @param nestedLevelsToAdd 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @param nestedLevelsCount 
 * @returns 
 */
export async function authorizeNestedLevels(req: Request, nestedLevelsToAdd: number = 1, res?: Response, nestedLevelsCount?: number): Promise<boolean | Response<any, Record<string, any>>> {
    const log = getLogger().child({ step: 'authorizeNestedLevels' });

    try {
        log.debug({ reqUser: req.user })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        const tr = new TreeNodeRepository

        nestedLevelsCount = nestedLevelsCount ?? await runWithLogger(log, () => tr.countMaxNestedLevelsForUser(req.user!.userId))
        log.debug({ nestedLevelsCount })

        if (typeof nestedLevelsCount === 'number' && (nestedLevelsCount + nestedLevelsToAdd) >= req.user.privileges.nestedLevels) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeNestedLevels function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}

/**
 * 
 * @param req 
 * @param categoryId 
 * @param cardsToAdd 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @returns 
 */
export async function authorizeCardsPerCategory(req: Request, categoryId: string, cardsToAdd: number = 1, res: Response): Promise<boolean | Response<any, Record<string, any>>> {
    const log = getLogger().child({ step: 'authorizeCardsPerCategory' });

    try {
        log.debug({ reqUser: req.user })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false
        }

        const lr = new LeafRepository

        const cardsPerCategory: number | undefined = await runWithLogger(log, () => lr.countCardsPerCategoryForUser(req.user!.userId, categoryId))
        log.debug({ cardsPerCategory })

        if (typeof cardsPerCategory === 'number' && (cardsPerCategory + cardsToAdd) >= req.user.privileges.cardsPerCategory) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeCardsPerCategory function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false
    }
}

/**
 * 
 * @param req 
 * @param leafId 
 * @param isTerm 
 * @param contentsToAdd 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @param contentsPerCardSideCount 
 * @returns 
 */
export async function authorizeContentsPerCardSide(req: Request, leafId: string, isTerm: boolean, contentsToAdd: number = 1, res?: Response, contentsPerCardSideCount?: number): Promise<boolean | Response<any, Record<string, any>>> {
    const log = getLogger().child({ step: 'authorizeContentsPerCardSide' });

    try {
        log.debug({ reqUser: req.user })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        const lr = new LeafRepository

        contentsPerCardSideCount = contentsPerCardSideCount ?? await runWithLogger(log, () => lr.countContentsPerCardSideForUser(req.user!.userId, leafId, isTerm))
        log.debug({ contentsPerCardSideCount })

        if (typeof contentsPerCardSideCount === 'number' && (contentsPerCardSideCount + contentsToAdd) >= req.user.privileges.contentsPerCardSide) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeContentsPerCardSide function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}

/**
 * 
 * @param req 
 * @param leafId 
 * @param isTerm 
 * @param content 
 * @param valuePerContentCount 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @param valuesToAdd 
 * @returns 
 */
export async function authorizeValuePerContent(req: Request, leafId: string, isTerm: boolean, content: keyof Privileges['valuePerContent'], valuePerContentCount: number, res?: Response, valuesToAdd: number = 1): Promise<boolean | Response<any, Record<string, any>>> {
    const log = getLogger().child({ step: 'authorizeValuePerContent' });

    try {

        log.debug({ reqUser: req.user, leafId, isTerm, content, valuePerContentCount, valuesToAdd })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if ((valuePerContentCount + valuesToAdd) >= req.user.privileges.valuePerContent[content]) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeValuePerContent function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}

/**
 * 
 * @param req 
 * @param contentType 
 * @param res if provided, 402 response is sent in case of a failure, nothing otherwise.
 * @returns 
 */
export function authorizeAllowedContentTypes(req: Request, contentType: keyof Privileges['allowedContentTypes'], res?: Response): boolean | Response<any, Record<string, any>> {
    const log = getLogger().child({ step: 'authorizeAllowedContentTypes' });

    try {
        log.debug({ reqUser: req.user, contentType })

        if (!req.user || !req.user.userData || !req.user.userId) {
            log.info('Denied: no authenticated user on request');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (!req.user.privileges) {
            log.info('Denied: user has no active subscription');
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        if (req.user.privileges.allowedContentTypes[contentType]) {
            log.info('Request is unauthorized')
            return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
        }

        log.info('Request is authorized')
        return true
    } catch (err) {
        log.error({ err }, 'caught error in authorizeAllowedContentTypes function')
        return res?.status(402).json({ status: 'error', error_code: 'QUOTA_EXCEEDED' }) ?? false;
    }
}
