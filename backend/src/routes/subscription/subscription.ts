import { Response, Router } from "express";
import { auth, unAuth } from "../../middlewares/auth";
import { getLogger, runWithLogger } from "../../observability/requestLoggerContext";
import { A_MONTH_IN_MILLISECONDS, A_YEAR_IN_MILLISECONDS, handleError, validate } from "../../lib";
import { Redis } from "../../DB/redis";
import { postSchema, zarinpalVerifyCheckSchema, zarinpalVerifySchema, zibalVerifySchema } from "./schemas";
import SubscriptionRepository from "../../DB/repositories/SubscriptionRepository";
import { Subscription, SubscriptionCreate, subscriptionCreateSchema } from "../../DB/models/Subscription";
import { appUrl } from "../../configs";
import { payments } from "../..";
import { randomUUID } from "node:crypto";
import { fetchBusinessPlan, resolveCurrencyAndPayment, calculatePricesForSubscriptionDue } from "./lib";
import UsageRepository from "../../DB/repositories/UsageRepository";
import AppSettingsRepository from "../../DB/repositories/AppSettingsRepository";
import { WithId } from "mongodb";

const router = Router();

const PAYMENT_CHECKPOINT_BASE = '/api/subscription'

const ZARINPAL_PAYMENT_BASE = `/zarinpal`
const ZARINPAL_PAYMENT_VERIFY = `${ZARINPAL_PAYMENT_BASE}/verify`                                                       // /zarinpal/verify
const ZARINPAL_PAYMENT_VERIFY_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZARINPAL_PAYMENT_VERIFY}`                             // /api/subscription/zarinpal/verify
export const ZARINPAL_PAYMENT_VERIFY_CALLBACK_URL = (subscriptionId: string) => `https://${appUrl.replace('https://', '')}${ZARINPAL_PAYMENT_VERIFY_PATH}/${subscriptionId}`
const ZARINPAL_PAYMENT_VERIFY_CHECK = `${ZARINPAL_PAYMENT_VERIFY}/check`                                                // /zarinpal/verify/check
const ZARINPAL_PAYMENT_VERIFY_CHECK_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZARINPAL_PAYMENT_VERIFY_CHECK}`                 // /zarinpal/verify/check

const ZIBAL_PAYMENT_BASE = `/zibal`
const ZIBAL_PAYMENT_VERIFY = `${ZIBAL_PAYMENT_BASE}/verify`                                                       // /zibal/verify
const ZIBAL_PAYMENT_VERIFY_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZIBAL_PAYMENT_VERIFY}`                             // /api/subscription/zibal/verify
export const ZIBAL_PAYMENT_VERIFY_CALLBACK_URL = (subscriptionId: string) => `https://${appUrl.replace('https://', '')}${ZIBAL_PAYMENT_VERIFY_PATH}/${subscriptionId}`
const ZIBAL_PAYMENT_VERIFY_CHECK = `${ZIBAL_PAYMENT_VERIFY}/check`                                                // /zibal/verify/check
const ZIBAL_PAYMENT_VERIFY_CHECK_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZIBAL_PAYMENT_VERIFY_CHECK}`                 // /zibal/verify/check

router.get('/', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${PAYMENT_CHECKPOINT_BASE}` });

    try {
        log.info('subscription fetch request received');

        const sr = new SubscriptionRepository()
        const subscription = await runWithLogger(log, () => sr.getByStatusForUser(req.user!.userId, ['active', 'trial']))
        if (!subscription || subscription.length !== 1) {
            log.info('subscription not found')
            return res.status(404).json({ status: 'error', error_code: 'SUBSCRIPTION_NOT_FOUND' })
        }

        log.info('sending subscription')
        return res.status(200).json({ status: 'success', data: subscription[0] })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

router.get(`/supported_payment_methods`, auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${PAYMENT_CHECKPOINT_BASE}/supported_payment_methods` });

    try {
        log.info('supported payment methods list request received');

        const methods = []
        if (payments.zarinpal)
            methods.push('zarinpal')
        if (payments.zibal)
            methods.push('zibal')
        if (payments.paypal)
            methods.push('paypal')
        log.debug({ methods })

        log.info('sending payment methods')
        return res.status(200).json({ status: 'success', data: { methods } })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

router.get('/upgrade/calculate', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'GET /api/subscription/upgrade/calculate' });

    try {
        log.info('subscription upgrade calculation request received');

        log.debug({ query: req.query });
        const { planTitle, paymentMethod, subscriptionDueTSMS } = await runWithLogger(log, () => validate(postSchema, req.query))
        log.debug({ planTitle, paymentMethod, subscriptionDueTSMS });

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const nowTS = Date.now()
        if (subscriptionDueTSMS <= nowTS) {
            log.info("invalid 'subscriptionDueTSMS' provided")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_SUBSCRIPTION_DUE' })
        }

        log.info('input validated');

        const userId = req.user!.userId;
        log.debug({ userId });

        const appSettingsRepository = new AppSettingsRepository()
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if more than one active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getActiveByUserId(userId))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 1) {
            log.warn('user has too many subscriptions active!')
            return res.status(500).json({ status: 'error' })
        }
        if (subscriptions.length === 0) {
            log.info('user has no active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_NO_ACTIVE_PLAN' })
        }
        const activeSubscription = subscriptions[0]
        const expired = !activeSubscription.currentPeriodEnd || activeSubscription.currentPeriodEnd <= nowTS
        log.debug({ activeSubscription, expired })
        if (expired) {
            log.info("active plan is expired")
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_EXPIRED' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        const currentPlan = await fetchBusinessPlan({ log, planTitle: activeSubscription.planTitle, res })
        if (!currentPlan) return

        const requestedPlan = await fetchBusinessPlan({ log, planTitle, res })
        if (!requestedPlan) return

        // ------------------------------------------------------------------------- resolving currency and payment method and callback url
        const resolved = await resolveCurrencyAndPayment({ log, paymentMethod, res })
        if (!resolved) return
        const [currency, payment, callback] = resolved

        // ------------------------------------------------------------------------- check if the active subscription with same title exist, or if the currency doesn't match
        log.info("check if the active subscription with same title exist, or if the currency doesn't match")
        if (activeSubscription.planTitle === planTitle) {
            log.info('plan is already active')
            return res.status(400).json({ status: 'error', error_code: 'PLAN_ALREADY_ACTIVE' })
        }
        if (activeSubscription.payment.currency !== currency) {
            log.info('active plan is in another currency')
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_CURRENCY_MISMATCH' })
        }

        // ------------------------------------------------------------------------- calculating price
        const remainingDueOfActiveSubscriptionPriceCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: currentPlan,
            durationMS: activeSubscription.currentPeriodEnd! - nowTS,
            currency: currency,
            privilegesStorageBytes: activeSubscription.privileges.storageBytes,
            appSettingsRepository,
            res
        })
        if (!remainingDueOfActiveSubscriptionPriceCalculations) return
        const [, , remainingTotalPrice] = remainingDueOfActiveSubscriptionPriceCalculations

        const dueCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: requestedPlan,
            durationMS: subscriptionDueTSMS! - nowTS,
            currency: currency,
            privilegesStorageBytes: activeSubscription.privileges.storageBytes,
            appSettingsRepository,
            res
        })
        if (!dueCalculations) return
        const [, , dueTotalPrice] = dueCalculations

        let totalPrice = dueTotalPrice - remainingTotalPrice
        if (activeSubscription.payment.amount < 0)
            totalPrice += activeSubscription.payment.amount

        log.debug({ remainingDueOfActiveSubscriptionPriceCalculations, dueCalculations, totalPrice })

        if (totalPrice < 0)
            log.info({ totalPrice }, "we are in dept to user")

        return res.status(200).json({ status: 'success', data: { totalPrice, currency } })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.post('/upgrade', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'POST /api/subscription/upgrade' });

    try {
        log.info('subscription upgrade request received');

        log.debug({ body: req.body });
        const { planTitle, paymentMethod, subscriptionDueTSMS } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.debug({ planTitle, paymentMethod, subscriptionDueTSMS });

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const nowTS = Date.now()
        if (subscriptionDueTSMS <= nowTS) {
            log.info("invalid 'subscriptionDueTSMS' provided")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_SUBSCRIPTION_DUE' })
        }

        log.info('input validated');

        const userId = req.user!.userId;
        log.debug({ userId });

        const redis = await Redis.getClient();
        const appSettingsRepository = new AppSettingsRepository()
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if more than one active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getActiveByUserId(userId))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 1) {
            log.warn('user has too many subscriptions active!')
            return res.status(500).json({ status: 'error' })
        }
        if (subscriptions.length === 0) {
            log.info('user has no active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_NO_ACTIVE_PLAN' })
        }
        const activeSubscription = subscriptions[0]
        const expired = !activeSubscription.currentPeriodEnd || activeSubscription.currentPeriodEnd <= nowTS
        log.debug({ activeSubscription, expired })
        if (expired) {
            log.info("active plan is expired")
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_EXPIRED' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        const currentPlan = await fetchBusinessPlan({ log, planTitle: activeSubscription.planTitle, res })
        if (!currentPlan) return

        const requestedPlan = await fetchBusinessPlan({ log, planTitle, res })
        if (!requestedPlan) return

        // ------------------------------------------------------------------------- resolving currency and payment method and callback url
        const resolved = await resolveCurrencyAndPayment({ log, paymentMethod, res })
        if (!resolved) return
        const [currency, payment, callback] = resolved

        // ------------------------------------------------------------------------- check if the currency doesn't match
        log.info("check if the active subscription with same title exist, or if the currency doesn't match")
        if (activeSubscription.planTitle === planTitle) {
            log.info('plan renewal is requested, checking subscription due')
            return res.status(400).json({ status: 'error', error_code: 'PLAN_ALREADY_ACTIVE' })
        }
        if (activeSubscription.payment.currency !== currency) {
            log.info('active plan is in another currency')
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_CURRENCY_MISMATCH' })
        }

        // ------------------------------------------------------------------------- calculating price
        const remainingDueOfActiveSubscriptionPriceCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: currentPlan,
            durationMS: activeSubscription.currentPeriodEnd! - nowTS,
            currency: currency,
            privilegesStorageBytes: activeSubscription.privileges.storageBytes,
            appSettingsRepository,
            res
        })
        if (!remainingDueOfActiveSubscriptionPriceCalculations) return
        const [, , remainingTotalPrice] = remainingDueOfActiveSubscriptionPriceCalculations

        const dueCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: requestedPlan,
            durationMS: subscriptionDueTSMS! - nowTS,
            currency: currency,
            privilegesStorageBytes: activeSubscription.privileges.storageBytes,
            appSettingsRepository,
            res
        })
        if (!dueCalculations) return
        const [, , dueTotalPrice] = dueCalculations

        let totalPrice = dueTotalPrice - remainingTotalPrice
        if (activeSubscription.payment.amount < 0)
            totalPrice += activeSubscription.payment.amount

        log.debug({ remainingDueOfActiveSubscriptionPriceCalculations, dueCalculations, totalPrice })

        if (totalPrice < 0)
            log.warn({ totalPrice }, "we are in dept to user")

        // ------------------------------------------------------------------------- deleting old subscriptions with 'paymentNotCompleted' status
        log.info("deleting old subscriptions with 'paymentNotCompleted' status")
        const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteDanglingStatusForUser(userId))
        log.debug({ deleteResult })

        // ------------------------------------------------------------------------- creating temporary subscription with status 'paymentNotCompleted'
        log.info("creating temporary subscription with status 'paymentNotCompleted'")
        // Using activeSubscription in order to preserve storage quota upgrades
        const subscriptionCreate: SubscriptionCreate = subscriptionCreateSchema.cast({
            userId,
            status: 'paymentNotCompleted',
            planTitle,
            currentPeriodEnd: subscriptionDueTSMS,
            privileges: requestedPlan.privileges,
            payment: {
                amount: totalPrice,
                currency,
                method: paymentMethod
            }
        } as SubscriptionCreate);
        subscriptionCreate.privileges.storageBytes = activeSubscription.privileges.storageBytes

        if (totalPrice <= 0) subscriptionCreate.status = 'active'

        log.info({ ...subscriptionCreate, ...({ expirationDate: new Date(subscriptionDueTSMS).toUTCString() }) }, "storing user's subscription")
        const insertResult = await runWithLogger(log, () => subscriptionRepository.insert(subscriptionCreate))
        log.debug({ insertResult })
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            log.info('failed to store user\'s subscription')
            return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
        }
        if (totalPrice <= 0) {
            log.info("since calculated 'totalPrice' is equal to or less than zero, this subscription is considered free and therefor it is created with 'active' status")
            return res.status(201).json({ status: 'success' })
        }
        const newSubscription: WithId<Subscription> = { ...subscriptionCreate, _id: insertResult.insertedId }

        // ------------------------------------------------------------------------- storing the created subscription in session
        log.info('storing the created subscription in session')
        const redisKey = `plan_request:${userId}`
        await redis.set(redisKey, JSON.stringify(newSubscription), 'EX', 60)

        // ------------------------------------------------------------------------- requesting payment
        log.info('requesting payment')
        const result = await runWithLogger(log, () => payment.request(totalPrice, callback(newSubscription._id!.toString())))
        log.debug({ result })
        if (result == false) {
            log.error('system failed to request a payment')
            return res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })
        }

        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get('/calculate', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'GET /api/subscription/calculate' });

    try {
        log.info('subscription calculation request received');

        // ------------------------------------------------------------------------- validation
        log.debug({ query: req.query });
        const { planTitle, paymentMethod, subscriptionDueTSMS } = await runWithLogger(log, () => validate(postSchema, req.query))
        log.debug({ planTitle, paymentMethod, subscriptionDueTSMS });

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const nowTS = Date.now()
        if (subscriptionDueTSMS <= nowTS) {
            log.info("invalid 'subscriptionDueTSMS' provided")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_SUBSCRIPTION_DUE' })
        }

        log.info('input validated');

        const userId = req.user!.userId;
        log.debug({ userId });

        const redis = await Redis.getClient();
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if any active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getActiveByUserId(userId))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length === 1) {
            log.info('user already has an active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_ACTIVE_PLAN' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        const plan = await fetchBusinessPlan({ log, planTitle, res })
        if (!plan) return

        // ------------------------------------------------------------------------- resolving currency and payment method and callback url
        const resolved = await resolveCurrencyAndPayment({ log, paymentMethod, res })
        if (!resolved) return
        const [currency, payment, callback] = resolved

        // ------------------------------------------------------------------------- calculating 
        const dueCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: plan,
            durationMS: subscriptionDueTSMS - nowTS,
            currency: currency,
            res
        })
        if (!dueCalculations) return
        const [, , totalPrice] = dueCalculations

        return res.status(200).json({ status: 'success', data: { totalPrice } });
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.post('/', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'POST /api/subscription/' });

    try {
        log.info('subscription request received');

        // ------------------------------------------------------------------------- validation
        log.debug({ body: req.body });
        const { planTitle, paymentMethod, subscriptionDueTSMS } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.debug({ planTitle, paymentMethod, subscriptionDueTSMS });

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const nowTS = Date.now()
        if (subscriptionDueTSMS <= nowTS) {
            log.info("invalid 'subscriptionDueTSMS' provided")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_SUBSCRIPTION_DUE' })
        }

        log.info('input validated');

        const userId = req.user!.userId;
        log.debug({ userId });

        const redis = await Redis.getClient();
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if any active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getActiveByUserId(userId))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length === 1) {
            log.info('user already has an active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_ACTIVE_PLAN' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        const plan = await fetchBusinessPlan({ log, planTitle, res })
        if (!plan) return

        // ------------------------------------------------------------------------- resolving currency and payment method and callback url
        const resolved = await resolveCurrencyAndPayment({ log, paymentMethod, res })
        if (!resolved) return
        const [currency, payment, callback] = resolved

        // ------------------------------------------------------------------------- calculating 
        const dueCalculations = await calculatePricesForSubscriptionDue({
            log,
            plan: plan,
            durationMS: subscriptionDueTSMS - nowTS,
            currency: currency,
            res
        })
        if (!dueCalculations) return
        const [, , totalPrice] = dueCalculations

        // ------------------------------------------------------------------------- deleting old subscriptions with 'paymentNotCompleted' status
        log.info("deleting old subscriptions with 'paymentNotCompleted' status")
        const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteDanglingStatusForUser(userId))
        log.debug({ deleteResult })

        // ------------------------------------------------------------------------- creating temporary subscription with status 'paymentNotCompleted'
        log.info("creating temporary subscription with status 'paymentNotCompleted'")
        const subscriptionCreate: SubscriptionCreate = subscriptionCreateSchema.cast({
            userId,
            status: 'paymentNotCompleted',
            planTitle,
            currentPeriodEnd: subscriptionDueTSMS,
            privileges: plan.privileges,
            payment: {
                amount: totalPrice,
                currency,
                method: paymentMethod
            }
        } as SubscriptionCreate);

        log.info({ ...subscriptionCreate, ...({ expirationDate: new Date(subscriptionDueTSMS).toUTCString() }) }, "storing user's subscription")
        const insertResult = await runWithLogger(log, () => subscriptionRepository.insert(subscriptionCreate))
        log.debug({ insertResult })
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            log.info('failed to store user\'s subscription')
            return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
        }
        const newSubscription: WithId<Subscription> = { ...subscriptionCreate, _id: insertResult.insertedId }

        // ------------------------------------------------------------------------- storing the created subscription in session for 30 minutes
        log.info('storing the created subscription in session')
        const redisKey = `plan_request:${newSubscription._id!.toString()}`
        log.debug({ redisKey })
        await redis.set(redisKey, JSON.stringify(newSubscription), 'EX', 60 * 30)

        // ------------------------------------------------------------------------- requesting payment
        log.info('requesting payment')
        const result = await runWithLogger(log, () => payment.request(totalPrice, callback(newSubscription._id!.toString())))
        log.debug({ result })
        if (result === false) {
            log.error('system failed to request a payment')
            return res.status(500).json({ status: 'error', message: 'INTERNAL_ERROR' })
        }

        return res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get(`${ZARINPAL_PAYMENT_VERIFY}/:subscriptionId/:authority`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${ZARINPAL_PAYMENT_VERIFY_PATH}/:subscriptionId/:authority` });

    try {
        log.info('zarinpal subscription verification request received');

        return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get(`/${ZARINPAL_PAYMENT_VERIFY_CHECK}`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${ZARINPAL_PAYMENT_VERIFY_CHECK_PATH}` });

    try {
        log.info('zarinpal subscription verification check request received');

        return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

router.post(`${ZIBAL_PAYMENT_VERIFY}/:subscriptionId`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `POST ${ZIBAL_PAYMENT_VERIFY_PATH}/:subscriptionId` });

    try {
        log.info('zibal subscription verification request received');

        log.debug({ params: req.params, query: req.query });
        const { success, trackId, status, subscriptionId } = await runWithLogger(log, () => validate(zibalVerifySchema, { ...req.query, ...req.params }))
        log.debug({ success, trackId, status, subscriptionId });
        log.info('input validated');

        if (success !== '1') {
            log.info('payment failed')
            return redirect(res, { status: 'error', error_code: 'NO_SUBSCRIPTION' })
        }

        const redis = await Redis.getClient()
        const rp = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetching the subscription
        log.info('fetching the subscription')
        const redisKey = `plan_request:${subscriptionId}`
        const subscriptionStr = await redis.get(redisKey)
        log.debug({ redisKey, subscriptionStr })
        if (!subscriptionStr) {
            log.info('system failed to fetch the subscription')
            return redirect(res, { status: 'error', error_code: 'NO_SUBSCRIPTION' })
        }

        let subscription: WithId<Subscription>
        try {
            subscription = JSON.parse(subscriptionStr) as WithId<Subscription>
        } catch (e) {
            log.warn('system failed to parse the stored subscription json string in session')
            return redirect(res, { status: 'error', error_code: 'NO_SUBSCRIPTION' })
        }
        log.debug({ subscription })

        const resolved = await resolveCurrencyAndPayment({ log, paymentMethod: subscription.payment.method, res })
        if (!resolved) return
        const [, payment] = resolved

        const userId = subscription.userId

        // ------------------------------------------------------------------------- cancelling, updating subscription status to 'canceled'
        const cancel = async () => {
            log.info("cancelling, updating subscription status to 'canceled'")
            let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'canceled' }))
            log.debug({ updateResult })
            if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
                log.info('failed to cancel user\'s subscription')
                // cronjob will clean up the subscription
            }
        }

        // ------------------------------------------------------------------------- reversing payment
        const rollbackPayment = async () => {
            log.info('reversing payment')
            const result = await runWithLogger(log, () => payment.reverse({ trackId }))
            if (result == false) {
                log.error('system failed to reverse a payment, user payment will be rolled back by the payment provider automatically')
                // cronjob will clean up the subscription
            }
        }

        // ------------------------------------------------------------------------- updating subscription status to 'paymentNotVerified'
        // ------------------------------------------------------------------------- this section is added in case, the process is interrupted exactly after verifying payment section, 
        // ------------------------------------------------------------------------- the situation is then handled in a cron job scheduled when starting this server process 
        log.info("updating subscription status to 'paymentNotVerified'")
        let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'paymentNotVerified', payment: { ...(subscription.payment), authority: trackId, completedAt: Date.now() } }))
        log.debug({ updateResult })
        if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
            log.info('failed to update user\'s subscription, user payment will be rolled back by the payment provider automatically')
            return redirect(res, { status: 'error', message: 'subscription process failed, user payment will be rolled back by the payment provider automatically.' })
            // cronjob will clean up the subscription
        }

        // ------------------------------------------------------------------------- verifying payment
        log.info('verifying payment')
        const result = await runWithLogger(log, () => payment.verify({ trackId }))
        log.debug({ result })
        if (result == false) {
            log.error('system failed to verify a payment, user payment will be rolled back by the payment provider automatically')
            redirect(res, { status: 'error', message: 'INTERNAL_ERROR' })

            await cancel()
            return
        }
        const { refId } = result

        // ------------------------------------------------------------------------- remove user's valid subscriptions
        log.info("remove user's valid subscriptions")
        const deleteResult = await runWithLogger(log, () => rp.deleteByStatusForUser(userId, ['active', 'trial']))
        if (!deleteResult.acknowledged) {
            redirect(res, { status: 'error', message: 'INTERNAL_ERROR' })

            await rollbackPayment()

            await cancel()

            return
        }

        // ------------------------------------------------------------------------- updating subscription status to 'active'
        log.info("updating subscription status to 'active'")
        updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'active', payment: { ...(subscription.payment), verifiedAt: Date.now(), refId }, }))
        log.debug({ updateResult, ...({ expirationDate: new Date(subscription.currentPeriodEnd).toUTCString() }) })
        if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
            log.info('failed to store user\'s subscription')
            redirect(res, { status: 'error', message: 'subscription process failed.' })

            // rollback payment
            await rollbackPayment()

            await cancel()

            return
        }

        // to stop false success payment response redirects to be used by unauthenticated users
        const uuid = randomUUID()
        await redis.set(`payment_results:${uuid}`, 1,)

        return redirect(res, { status: 'success', data: uuid })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
});

router.get(`/${ZIBAL_PAYMENT_VERIFY_CHECK}`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${ZIBAL_PAYMENT_VERIFY_CHECK_PATH}` });

    try {
        log.info('zibal subscription verification check request received');

        log.debug({ query: req.query });
        const { uuid } = await runWithLogger(log, () => validate(zarinpalVerifyCheckSchema, req.query))
        log.debug({ uuid });
        log.info('input validated');

        const redis = await Redis.getClient()
        const redisKey = `payment_results:${uuid}`
        const exists = (await redis.exists(redisKey)) === 1
        log.debug({ exists });
        if (!exists) {
            log.info('payment uuid not found')
            return res.status(400).json({ status: 'error', error_code: 'UUID_NOT_FOUND' })
        }

        log.info('payment uuid found')
        return res.status(204).json({ status: 'success' })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

// Cancelling a subscription is currently not supported
// router.delete(`/`, auth, async (req, res) => {
//     const log = getLogger().child({ module: 'subscription', route: `GET ${ZIBAL_PAYMENT_VERIFY_CHECK_PATH}` });

//     try {
//         log.info('subscription verification request received');

//         const uu = new UsageRepository()
//         const sr = new SubscriptionRepository()

//         // ------------------------------------------------------------------------- deleting subscription with status 'active'
//         log.info("deleting subscription with status 'active'")
//         const deleteResult = await runWithLogger(log, () => sr.deleteByStatusForUser(req.user!.userId, ['active', 'trial']))
//         log.debug({ updateResult: deleteResult })
//         if (!deleteResult.acknowledged) {
//             log.info("failed to cancel user's subscription")
//             return res.status(500).json({ status: 'error' })
//         }

//         // ------------------------------------------------------------------------- deleting user usage
//         log.info("deleting user usage")
//         const deleteUserUsageResult = await runWithLogger(log, () => uu.deleteByUserId(req.user!.userId))
//         log.debug({ deleteUserUsageResult: deleteUserUsageResult })
//         if (!deleteUserUsageResult) {
//             log.info("failed to cancel user's subscription")
//             return res.status(500).json({ status: 'error' })
//         }

//         log.info("successfully canceled user's subscription")
//         return res.status(204).json({ status: 'success' })
//     } catch (error) {
//         runWithLogger(log, () => handleError(res, error))
//     }
// })

router.post('/api/subscription/storage', async (req, res) => {
    // data: {'storage': _selectedGb!, 'calculatedPrice': totalFor(_currency!, _selectedGb!), 'currency': _currency!.name},
    // return redirect
})

function redirect(res: Response, params: Record<string, string>) {
    const query = new URLSearchParams(params as Record<string, string>).toString();

    return res.redirect(`https://${appUrl.replace('https://', '')}/#/payment/result?${query}`);
}

export { router as subscriptionRoutes }
