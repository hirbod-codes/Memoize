import { Request, Response, Router } from "express";
import { auth, unAuth } from "../../middlewares/auth";
import PlanRepository from "../../DB/repositories/PlanRepository";
import { getLogger, runWithLogger } from "../../observability/requestLoggerContext";
import { A_MONTH_IN_MILLISECONDS, handleError, validate } from "../../lib";
import { Redis } from "../../DB/redis";
import { postSchema, verifySchema } from "./schemas";
import SubscriptionRepository from "../../DB/repositories/SubscriptionRepository";
import { Subscription, SubscriptionCreate } from "../../DB/models/Subscription";
import { appUrl } from "../../configs";
import { payments } from "../..";

const router = Router();

router.post('/', auth, async (req, res) => {
    const log = getLogger().child({ module: 'plan', route: 'GET /api/plan' });

    try {
        log.info('plan request received');

        log.debug({ body: req.body });
        const { planTitle, paymentMethod } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.info('input validated');
        log.debug({ planTitle });

        const userId = req.user!.userId;
        log.debug({ userId });

        const planRepository = new PlanRepository()
        const subscriptionRepository = new SubscriptionRepository()

        log.info('check if a same active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getByStatusByTitleForUser(userId, ['active', 'trialing'], planTitle))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 0) {
            log.info('user already has a subscription with same title active')
            return res.status(400).json({ status: 'error', message: '' })
        }

        log.info('fetching business plans')
        const plans = await runWithLogger(log, () => planRepository.getAll())
        const plan = plans.find(f => f.title === planTitle)
        log.debug({ plan, plans })
        if (plan === undefined) {
            log.info('No plan found with the provided plan title')
            return res.status(400).json({ status: 'error', message: 'invalid plan title provided' })
        }

        log.info('resolving currency and payment method')
        let currency: Subscription['price']['currency']
        switch (paymentMethod) {
            case 'zarinpal':
                currency = 'IRT'
                break;

            case 'paypal':
                currency = 'USD'
                break;

            case 'bitcoin':
                currency = 'BTC'
                break;

            default:
                throw new Error('UNSUPPORTED_PAYMENT_METHOD')
        }
        const planRawPrice = plan.price[currency]
        let amount: number = planRawPrice
        const payment: IPay = payments[paymentMethod]!

        log.info('fetching current valid subscriptions to calculate price')
        const validSubscriptions = await runWithLogger(log, () => subscriptionRepository.getByStatusForUser(userId, ['active', 'trialing']))
        log.debug({ validSubscriptions })
        if (validSubscriptions.length !== 0) {
            log.info('calculating price')

            const validSubscription = validSubscriptions[validSubscriptions.length - 1]
            log.debug({ validSubscription })

            if (validSubscription.price.currency === currency) {
                const nowTS = Date.now()
                const unusedPlanFraction = (nowTS - validSubscription.currentPeriodEnd) / A_MONTH_IN_MILLISECONDS
                amount = planRawPrice - (unusedPlanFraction * validSubscription.price.amount)
                log.info({
                    calculatedPrice: amount,
                    planRawPrice,
                    nowTS,
                    validSubscriptionCurrentPeriodEndTS: validSubscription.currentPeriodEnd,
                    nowDate: new Date(nowTS).toUTCString(),
                    validSubscriptionCurrentPeriodEndDate: new Date(validSubscription.currentPeriodEnd).toUTCString(),
                    unusedPlanFraction
                })
            } else
                log.warn('currency conversion is not currently supported')
        }
        log.debug({ amount })

        const redis = await Redis.getClient();
        const redisKey = `plan_request:${userId}`

        log.info('deleting old subscriptions with \'paymentNotCompleted\' status')
        const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteDanglingStatusForUser(userId))
        log.debug({ deleteResult })

        const currentPeriodEnd = Date.now() + A_MONTH_IN_MILLISECONDS
        const subscriptionCreate: SubscriptionCreate = { userId, currentPeriodEnd, planTitle, paymentMethod, status: 'paymentNotCompleted', price: { currency, amount } }

        log.info({ ...subscriptionCreate, ...({ expirationDate: new Date(currentPeriodEnd).toUTCString() }) }, 'storing user\'s subscription')
        const insertResult = await runWithLogger(log, () => subscriptionRepository.insert(subscriptionCreate))
        log.debug({ insertResult })
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            log.info('failed to store user\'s subscription')
            return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
        }
        const subscription: Subscription = { ...subscriptionCreate, _id: insertResult.insertedId.toString() }

        log.info('requesting payment')
        const result = await runWithLogger(log, () => payment.request(amount, `https://${appUrl}${PAYMENT_CALLBACK_URL}/${subscription._id!.toString()}`))
        log.debug({ result })
        if (result == false) {
            log.error('system failed to request a payment')
            return res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })
        }

        log.info('storing session on redis')
        await redis.set(redisKey, JSON.stringify(subscription), 'EX', 60)

        return res.status(200).json({ status: 'ok', data: result });
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get(`/verify/check/:subscriptionId`, unAuth, async (req, res) => { })

const PAYMENT_CALLBACK_URL = '/api/plan/verify'
router.get(`/verify/:subscriptionId/:authority`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'plan', route: `GET ${PAYMENT_CALLBACK_URL}/:subscriptionId/:authority` });

    try {
        log.info('plan verification request received');

        log.debug({ body: req.body });
        const { subscriptionId, authority } = await runWithLogger(log, () => validate(verifySchema, req.params))
        log.info('input validated');
        log.debug({ subscriptionId, authority });

        // res.redirect(`https://${appUrl}/plan/verify/check/${subscriptionId}`)

        const rp = new SubscriptionRepository()

        log.info('fetching the subscription...')
        const subscription = await runWithLogger(log, () => rp.get(subscriptionId))
        log.debug({ subscription })
        if (!subscription) {
            log.info('system failed to fetch the subscription')
            return res.status(404).json({ status: 'NOT_FOUND', message: 'No subscription found' })
        }
        const { price: { amount }, paymentMethod } = subscription
        const payment: IPay = payments[paymentMethod]!
        const userId = subscription.userId

        const cancel = async () => {
            log.info('updating subscription status to \'canceled\'')
            let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'canceled' }))
            log.debug({ updateResult })
            if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                log.info('failed to cancel user\'s subscription')
                return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
                // cronjob will clean up the subscription
            }
        }

        const rollbackPayment = async () => {
            log.info('reversing payment...')
            const result = await runWithLogger(log, () => payment.reverse({ authority }))
            if (result == false) {
                log.error('system failed to reverse a payment, user payment will be rolled back by the payment provider automatically')
                return res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })
                // cronjob will clean up the subscription
            }
        }

        log.info('updating subscription status to \'paymentNotVerified\'')
        let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'paymentNotVerified', paymentAuthority: authority, completedAt: Date.now() }))
        log.debug({ updateResult })
        if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
            log.info('failed to store user\'s subscription, user payment will be rolled back by the payment provider automatically')
            return res.status(500).json({ status: 'error', message: 'subscription process failed, user payment will be rolled back by the payment provider automatically.' })
            // cronjob will clean up the subscription
        }

        log.info('verifying payment...')
        const result = await runWithLogger(log, () => payment.verify({ authority, amount }))
        log.debug({ result })
        if (result == false) {
            log.error('system failed to verify a payment, user payment will be rolled back by the payment provider automatically')
            res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })

            await cancel()
            return
        }
        const { refId, cardNumber, cardNumberHash } = result

        log.info('remove user\'s valid subscriptions')
        const deleteResult = await runWithLogger(log, () => rp.deleteByStatusForUser(userId, ['active', 'trialing']))
        if (!deleteResult.acknowledged) {
            res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })

            await rollbackPayment()

            await cancel()

            return
        }

        log.info('updating subscription status to \'active\'')
        updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'active', verifiedAt: Date.now(), refId, cardNumber, cardNumberHash }))
        log.debug({ updateResult })
        if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
            log.info('failed to store user\'s subscription')
            res.status(500).json({ status: 'error', message: 'subscription process failed.' })

            // rollback payment
            await rollbackPayment()

            await cancel()

            return
        }

        return res.status(204).json({ status: 'ok' })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get('/', async (req: Request, res: Response) => {
    const log = getLogger().child({ module: 'plan', route: 'GET /api/plan' });

    try {
        log.info('get all plans request received');

        const pr = new PlanRepository()
        const plans = await runWithLogger(log, () => pr.getAll())
        log.debug({ plans });

        res.status(200).json({ status: 'ok', data: { plans } })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

export { router as planRoutes }
