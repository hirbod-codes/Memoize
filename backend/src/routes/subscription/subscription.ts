import { Response, Router } from "express";
import { auth, unAuth } from "../../middlewares/auth";
import PlanRepository from "../../DB/repositories/PlanRepository";
import { getLogger, runWithLogger } from "../../observability/requestLoggerContext";
import { A_MONTH_IN_MILLISECONDS, A_YEAR_IN_MILLISECONDS, handleError, validate } from "../../lib";
import { Redis } from "../../DB/redis";
import { postSchema, zarinpalVerifyCheckSchema, zarinpalVerifySchema, zibalVerifySchema } from "./schemas";
import SubscriptionRepository from "../../DB/repositories/SubscriptionRepository";
import { Subscription, SubscriptionCreate } from "../../DB/models/Subscription";
import { appUrl } from "../../configs";
import { payments } from "../..";
import { UserRepository } from "../../DB/repositories/UserRepository";
import { randomUUID } from "node:crypto";
import { resolveCurrencyFromPaymentMethod } from "./lib";
import UsageRepository from "../../DB/repositories/UsageRepository";

const router = Router();

const PAYMENT_CHECKPOINT_BASE = '/api/subscription'

const ZARINPAL_PAYMENT_BASE = `/zarinpal`
const ZARINPAL_PAYMENT_VERIFY = `${ZARINPAL_PAYMENT_BASE}/verify`                                                       // /zarinpal/verify
const ZARINPAL_PAYMENT_VERIFY_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZARINPAL_PAYMENT_VERIFY}`                             // /api/subscription/zarinpal/verify
const ZARINPAL_PAYMENT_VERIFY_CALLBACK_URL = (subscriptionId: string) => `https://${appUrl.replace('https://', '')}${ZARINPAL_PAYMENT_VERIFY_PATH}/${subscriptionId}`
const ZARINPAL_PAYMENT_VERIFY_CHECK = `${ZARINPAL_PAYMENT_VERIFY}/check`                                                // /zarinpal/verify/check
const ZARINPAL_PAYMENT_VERIFY_CHECK_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZARINPAL_PAYMENT_VERIFY_CHECK}`                 // /zarinpal/verify/check

const ZIBAL_PAYMENT_BASE = `/zibal`
const ZIBAL_PAYMENT_VERIFY = `${ZIBAL_PAYMENT_BASE}/verify`                                                       // /zibal/verify
const ZIBAL_PAYMENT_VERIFY_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZIBAL_PAYMENT_VERIFY}`                             // /api/subscription/zibal/verify
const ZIBAL_PAYMENT_VERIFY_CALLBACK_URL = (subscriptionId: string) => `https://${appUrl.replace('https://', '')}${ZIBAL_PAYMENT_VERIFY_PATH}/${subscriptionId}`
const ZIBAL_PAYMENT_VERIFY_CHECK = `${ZIBAL_PAYMENT_VERIFY}/check`                                                // /zibal/verify/check
const ZIBAL_PAYMENT_VERIFY_CHECK_PATH = `${PAYMENT_CHECKPOINT_BASE}${ZIBAL_PAYMENT_VERIFY_CHECK}`                 // /zibal/verify/check

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

router.get(`/calculate_upgrade_price`, auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${PAYMENT_CHECKPOINT_BASE}/calculate_upgrade_price` });

    try {
        log.info('calculate upgrade price request received');

        // ------------------------------------------------------------------------- validation
        log.debug({ body: req.body });
        const { planTitle, paymentMethod } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.debug({ planTitle, paymentMethod });
        log.info('input validated');

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const userId = req.user!.userId;
        log.debug({ userId });

        const userRepository = new UserRepository()
        const planRepository = new PlanRepository()
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if more than one active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getByStatusForUser(userId, ['active', 'trial']))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 1) {
            log.warn('user has too many subscriptions active!')
            return res.status(500).json({ status: 'error' })
        }
        if (subscriptions.length === 0) {
            log.info('user has no active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_NO_ACTIVE_PLAN' })
        }

        // ------------------------------------------------------------------------- check if the active subscription has same title exist
        const activeSubscription = subscriptions[0]
        log.debug({ activeSubscription })
        const user = await runWithLogger(log, () => userRepository.get(userId))
        log.debug({ user })
        if (!user) {
            log.warn('user is not authenticated!')
            return res.status(500).json({ status: 'error' })
        }
        if (activeSubscription.planTitle === user.planTitle) {
            log.info('plan is already active')
            return res.status(400).json({ status: 'error', error_code: 'PLAN_ALREADY_ACTIVE' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        log.info('fetching business plans')
        const plans = await runWithLogger(log, () => planRepository.getAll())
        const plan = plans.find(f => f.title === planTitle)
        log.debug({ plan, plans })
        if (plan === undefined) {
            log.warn('No plan found with the provided plan title')
            return res.status(500).json({ status: 'error' })
        }

        // ------------------------------------------------------------------------- resolving currency and payment method
        log.info('resolving currency and payment method')
        let currency: Subscription['price']['currency'], callback: (subscriptionId: string) => string
        switch (paymentMethod) {
            case 'zarinpal':
                currency = 'IRT'
                callback = ZARINPAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'zibal':
                currency = 'IRR'
                callback = ZIBAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'paypal':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'USD'
                break;

            case 'bitcoin':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'BTC'
                break;

            default:
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
        }
        const planRawPrice = plan.price[currency]
        let amount: number = planRawPrice
        const payment: IPay = payments[paymentMethod]!

        // ------------------------------------------------------------------------- calculating price
        log.info('calculating price')
        if (activeSubscription.price.currency === currency) {
            const nowTS = Date.now()
            const unusedPlanFraction = (nowTS - activeSubscription.currentPeriodEnd) / A_MONTH_IN_MILLISECONDS
            amount = planRawPrice - (unusedPlanFraction * activeSubscription.price.amount)
            log.info({
                calculatedPrice: amount,
                planRawPrice,
                nowTS,
                validSubscriptionCurrentPeriodEndTS: activeSubscription.currentPeriodEnd,
                nowDate: new Date(nowTS).toUTCString(),
                validSubscriptionCurrentPeriodEndDate: new Date(activeSubscription.currentPeriodEnd).toUTCString(),
                unusedPlanFraction
            })
        } else {
            log.warn('currency conversion is not currently supported')
            return res.status(400).json({ status: 'error', error_code: 'MUST_USE_SAME_PAYMENT_METHOD_AS_PRECIOUS_PLAN' })
        }

        log.info({ amount })
        return res.status(200).json({ status: 'success', data: { amount } })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

router.post('/upgrade', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'POST /api/subscription/upgrade' });

    try {
        log.info('subscription upgrade request received');

        log.debug({ body: req.body });
        const { planTitle, paymentMethod, duration } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.debug({ planTitle, paymentMethod, duration });
        log.info('input validated');

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const userId = req.user!.userId;
        log.debug({ userId });

        const userRepository = new UserRepository()
        const planRepository = new PlanRepository()
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if more than one active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getByStatusForUser(userId, ['active', 'trial']))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 1) {
            log.warn('user has too many subscriptions active!')
            return res.status(500).json({ status: 'error' })
        }
        if (subscriptions.length === 0) {
            log.info('user has no active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_NO_ACTIVE_PLAN' })
        }

        // ------------------------------------------------------------------------- check if the active subscription with same title exist, if it's expired or if the currency doesn't match
        const activeSubscription = subscriptions[0]
        log.debug({ activeSubscription })
        if (activeSubscription.currentPeriodEnd <= Date.now()) {
            log.info('active plan is expired')
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_EXPIRED' })
        }

        const user = await runWithLogger(log, () => userRepository.get(userId))
        log.debug({ user })
        if (!user) {
            log.warn('user is not authenticated!')
            return res.status(500).json({ status: 'error' })
        }
        if (activeSubscription.planTitle === user.planTitle) {
            log.info('plan is already active')
            return res.status(400).json({ status: 'error', error_code: 'PLAN_ALREADY_ACTIVE' })
        }
        if (activeSubscription.price.currency !== resolveCurrencyFromPaymentMethod(paymentMethod)) {
            log.info('active plan is in another currency')
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_CURRENCY_MISMATCH' })
        }
        if (activeSubscription.duration !== duration) {
            log.info('active plan uses another duration')
            return res.status(400).json({ status: 'error', error_code: 'ACTIVE_PLAN_DURATION_MISMATCH' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        log.info('fetching business plans')
        const plans = await runWithLogger(log, () => planRepository.getAll())
        const plan = plans.find(f => f.title === planTitle)
        log.debug({ plan, plans })
        if (plan === undefined) {
            log.warn('No plan found with the provided plan title')
            return res.status(500).json({ status: 'error' })
        }

        // ------------------------------------------------------------------------- resolving currency and payment method
        log.info('resolving currency and payment method')
        let currency: Subscription['price']['currency'], callback: (subscriptionId: string) => string
        switch (paymentMethod) {
            case 'zarinpal':
                currency = 'IRT'
                callback = ZARINPAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'zibal':
                currency = 'IRR'
                callback = ZIBAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'paypal':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'USD'
                break;

            case 'bitcoin':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'BTC'
                break;

            default:
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
        }
        const planRawPrice = plan.price[currency]
        let amount: number = planRawPrice
        if (activeSubscription.duration !== 'month') amount *= 12
        const payment: IPay = payments[paymentMethod]!

        // ------------------------------------------------------------------------- calculating price
        log.info('calculating price')
        if (activeSubscription.price.currency === currency) {
            const nowTS = Date.now()
            const unusedPlanFraction = (activeSubscription.currentPeriodEnd - nowTS) / (activeSubscription.duration == 'month' ? A_MONTH_IN_MILLISECONDS : A_YEAR_IN_MILLISECONDS)
            amount = amount - (unusedPlanFraction * activeSubscription.price.amount)
            log.info({
                calculatedPrice: amount,
                planRawPrice,
                nowTS,
                validSubscriptionCurrentPeriodEndTS: activeSubscription.currentPeriodEnd,
                nowDate: new Date(nowTS).toUTCString(),
                validSubscriptionCurrentPeriodEndDate: new Date(activeSubscription.currentPeriodEnd).toUTCString(),
                unusedPlanFraction
            })
        } else {
            log.warn('currency conversion is not currently supported')
            return res.status(400).json({ status: 'error', error_code: 'MUST_USE_SAME_PAYMENT_METHOD_AS_PRECIOUS_PLAN' })
        }
        log.debug({ amount })

        const redis = await Redis.getClient();
        const redisKey = `plan_request:${userId}`

        // ------------------------------------------------------------------------- deleting old subscriptions with 'paymentNotCompleted' status
        log.info("deleting old subscriptions with 'paymentNotCompleted' status")
        const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteDanglingStatusForUser(userId))
        log.debug({ deleteResult })

        // ------------------------------------------------------------------------- creating temporary subscription with status 'paymentNotCompleted'
        log.info("creating temporary subscription with status 'paymentNotCompleted'")
        const currentPeriodEnd = Date.now() + A_MONTH_IN_MILLISECONDS
        const subscriptionCreate: SubscriptionCreate = { userId, currentPeriodEnd, planTitle, paymentMethod, status: 'paymentNotCompleted', price: { currency, amount }, duration }

        log.info({ ...subscriptionCreate, ...({ expirationDate: new Date(currentPeriodEnd).toUTCString() }) }, "storing user's subscription")
        const insertResult = await runWithLogger(log, () => subscriptionRepository.insert(subscriptionCreate))
        log.debug({ insertResult })
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            log.info('failed to store user\'s subscription')
            return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
        }
        const newSubscription: Subscription = { ...subscriptionCreate, _id: insertResult.insertedId.toString() }

        // ------------------------------------------------------------------------- storing the created subscription in session
        log.info('storing the created subscription in session')
        await redis.set(redisKey, JSON.stringify(newSubscription), 'EX', 60)

        // ------------------------------------------------------------------------- requesting payment
        log.info('requesting payment')
        const result = await runWithLogger(log, () => payment.request(amount, callback(newSubscription._id!.toString())))
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

router.post('/', auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: 'POST /api/subscription/' });

    try {
        log.info('subscription request received');

        // ------------------------------------------------------------------------- validation
        log.debug({ body: req.body });
        const { planTitle, paymentMethod, duration } = await runWithLogger(log, () => validate(postSchema, req.body))
        log.debug({ planTitle, paymentMethod, duration });
        log.info('input validated');

        if (planTitle === 'free') {
            log.info("invalid plan 'free' is chosen")
            return res.status(400).json({ status: 'error', error_code: 'INVALID_PLAN' })
        }

        const userId = req.user!.userId;
        log.debug({ userId });

        const redis = await Redis.getClient();
        const planRepository = new PlanRepository()
        const subscriptionRepository = new SubscriptionRepository()

        // ------------------------------------------------------------------------- fetch and check if any active subscription exist
        log.info('fetch and check if more than one active subscription exist')
        const subscriptions = await runWithLogger(log, () => subscriptionRepository.getByStatusForUser(userId, ['active', 'trial']))
        log.debug({ subscriptionsLength: subscriptions.length, subscriptions });
        if (subscriptions.length > 1) {
            log.warn('user has too many subscriptions active!')
            return res.status(500).json({ status: 'error' })
        }
        if (subscriptions.length === 1) {
            log.info('user already has an active subscription')
            return res.status(400).json({ status: 'error', error_code: 'USER_HAS_ACTIVE_PLAN' })
        }

        // ------------------------------------------------------------------------- fetching business plans
        log.info('fetching business plans')
        const plans = await runWithLogger(log, () => planRepository.getAll())
        const plan = plans.find(f => f.title === planTitle)
        log.debug({ plan, plans })
        if (plan === undefined) {
            log.warn('No plan found with the provided plan title')
            return res.status(500).json({ status: 'error' })
        }

        // ------------------------------------------------------------------------- resolving currency and payment method
        log.info('resolving currency and payment method')
        let currency: Subscription['price']['currency'], callback: (subscriptionId: string) => string
        switch (paymentMethod) {
            case 'zarinpal':
                currency = 'IRT'
                callback = ZARINPAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'zibal':
                currency = 'IRR'
                callback = ZIBAL_PAYMENT_VERIFY_CALLBACK_URL
                break;

            case 'paypal':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'USD'
                break;

            case 'bitcoin':
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
                currency = 'BTC'
                break;

            default:
                return res.status(400).json({ status: 'error', error_code: 'UNSUPPORTED_PAYMENT_METHOD' })
        }
        const planRawPrice = plan.price[currency]
        let amount: number = planRawPrice
        if (duration !== 'month') amount *= 12
        const payment: IPay = payments[paymentMethod]!
        log.debug({ planRawPrice, amount })

        // ------------------------------------------------------------------------- deleting old subscriptions with 'paymentNotCompleted' status
        log.info("deleting old subscriptions with 'paymentNotCompleted' status")
        const deleteResult = await runWithLogger(log, () => subscriptionRepository.deleteDanglingStatusForUser(userId))
        log.debug({ deleteResult })

        // ------------------------------------------------------------------------- creating temporary subscription with status 'paymentNotCompleted'
        log.info("creating temporary subscription with status 'paymentNotCompleted'")
        const currentPeriodEnd = Date.now() + A_MONTH_IN_MILLISECONDS
        const subscriptionCreate: SubscriptionCreate = { userId, currentPeriodEnd, planTitle, paymentMethod, status: 'paymentNotCompleted', price: { currency, amount }, duration }
        log.debug({ ...subscriptionCreate, ...({ expirationDate: new Date(currentPeriodEnd).toUTCString() }) })

        log.info("storing user's subscription")
        const insertResult = await runWithLogger(log, () => subscriptionRepository.insert(subscriptionCreate))
        log.debug({ insertResult })
        if (!insertResult.acknowledged || !insertResult.insertedId) {
            log.info('failed to store user\'s subscription')
            return res.status(500).json({ status: 'error', message: 'subscription process failed.' })
        }
        const newSubscription: Subscription = { ...subscriptionCreate, _id: insertResult.insertedId.toString() }

        // ------------------------------------------------------------------------- storing the created subscription in session for 30 minutes
        log.info('storing the created subscription in session')
        const redisKey = `plan_request:${newSubscription._id!.toString()}`
        log.debug({ redisKey })
        await redis.set(redisKey, JSON.stringify(newSubscription), 'EX', 60 * 30)

        // ------------------------------------------------------------------------- requesting payment
        log.info('requesting payment')
        const result = await runWithLogger(log, () => payment.request(amount, callback(newSubscription._id!.toString())))
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
        log.info('subscription verification request received');

        log.debug({ params: req.params });
        const { subscriptionId, authority } = await runWithLogger(log, () => validate(zarinpalVerifySchema, req.params))
        log.debug({ subscriptionId, authority });
        log.info('input validated');

        const redis = await Redis.getClient();
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

        let subscription: Subscription
        try {
            subscription = JSON.parse(subscriptionStr) as Subscription
        } catch (e) {
            log.warn('system failed to parse the stored subscription json string in session')
            return redirect(res, { status: 'error', error_code: 'NO_SUBSCRIPTION' })
        }
        log.debug({ subscription })

        const { price: { amount }, paymentMethod } = subscription
        const payment: IPay = payments[paymentMethod]!
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
            const result = await runWithLogger(log, () => payment.reverse({ authority }))
            if (result == false) {
                log.error('system failed to reverse a payment, user payment will be rolled back by the payment provider automatically')
                // cronjob will clean up the subscription
            }
        }

        // ------------------------------------------------------------------------- updating subscription status to 'paymentNotVerified'
        // ------------------------------------------------------------------------- this section is added in case, the process is interrupted exactly after verifying payment section, 
        // ------------------------------------------------------------------------- the situation is then handled in a cron job scheduled when starting this server process 
        log.info("updating subscription status to 'paymentNotVerified'")
        let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'paymentNotVerified', paymentAuthority: authority, completedAt: Date.now() }))
        log.debug({ updateResult })
        if (!updateResult.acknowledged || updateResult.matchedCount !== 1) {
            log.info('failed to update user\'s subscription, user payment will be rolled back by the payment provider automatically')
            return redirect(res, { status: 'error', message: 'subscription process failed, user payment will be rolled back by the payment provider automatically.' })
            // cronjob will clean up the subscription
        }

        // ------------------------------------------------------------------------- verifying payment
        log.info('verifying payment')
        const result = await runWithLogger(log, () => payment.verify({ authority, amount }))
        log.debug({ result })
        if (result == false) {
            log.error('system failed to verify a payment, user payment will be rolled back by the payment provider automatically')
            redirect(res, { status: 'error', message: 'INTERNAL_ERROR' })

            await cancel()
            return
        }
        const { refId, cardNumber, cardNumberHash } = result

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
        updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'active', verifiedAt: Date.now(), refId, cardNumber, cardNumberHash }))
        log.debug({ updateResult })
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

router.get(`/${ZARINPAL_PAYMENT_VERIFY_CHECK}`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${ZARINPAL_PAYMENT_VERIFY_CHECK_PATH}` });

    try {
        log.info('subscription verification request received');

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

router.post(`${ZIBAL_PAYMENT_VERIFY}/:subscriptionId`, unAuth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `POST ${ZIBAL_PAYMENT_VERIFY_PATH}/:subscriptionId` });

    try {
        log.info('subscription verification request received');

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

        let subscription: Subscription
        try {
            subscription = JSON.parse(subscriptionStr) as Subscription
        } catch (e) {
            log.warn('system failed to parse the stored subscription json string in session')
            return redirect(res, { status: 'error', error_code: 'NO_SUBSCRIPTION' })
        }
        log.debug({ subscription })

        const { price: { amount }, paymentMethod } = subscription
        const payment: IPay = payments[paymentMethod]!
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
        let updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'paymentNotVerified', paymentAuthority: trackId, completedAt: Date.now() }))
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
        updateResult = await runWithLogger(log, () => rp.unsafeUpdate(subscription._id!.toString(), userId, { status: 'active', verifiedAt: Date.now(), refId }))
        log.debug({ updateResult })
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
        log.info('subscription verification request received');

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

router.get(`/cancel`, auth, async (req, res) => {
    const log = getLogger().child({ module: 'subscription', route: `GET ${ZIBAL_PAYMENT_VERIFY_CHECK_PATH}` });

    try {
        log.info('subscription verification request received');

        const ur = new UserRepository()
        const uu = new UsageRepository()
        const sr = new SubscriptionRepository()

        // ------------------------------------------------------------------------- updating user planTitle to 'free'
        log.info("updating user planTitle to 'free'")
        const updateUserResult = await runWithLogger(log, () => ur.unsafeUpdate(req.user!.userId, { planTitle: 'free' }))
        log.debug({ updateUserResult: updateUserResult })
        if (!updateUserResult) {
            log.info("failed to cancel user's subscription")
            return res.status(500).json({ status: 'error' })
        }

        // ------------------------------------------------------------------------- updating subscription status to 'active'
        log.info("updating subscription status to 'active'")
        const deleteResult = await runWithLogger(log, () => sr.deleteByStatusForUser(req.user!.userId, ['active', 'trial']))
        log.debug({ updateResult: deleteResult })
        if (!deleteResult.acknowledged) {
            log.info("failed to cancel user's subscription")
            return res.status(500).json({ status: 'error' })
        }

        // ------------------------------------------------------------------------- deleting user usage
        log.info("deleting user usage")
        const deleteUserUsageResult = await runWithLogger(log, () => uu.deleteByUserId(req.user!.userId))
        log.debug({ deleteUserUsageResult: deleteUserUsageResult })
        if (!deleteUserUsageResult) {
            log.info("failed to cancel user's subscription")
            return res.status(500).json({ status: 'error' })
        }

        log.info("successfully canceled user's subscription")
        return res.status(204).json({ status: 'success' })
    } catch (error) {
        runWithLogger(log, () => handleError(res, error))
    }
})

function redirect(res: Response, params: Record<string, string>) {
    const query = new URLSearchParams(params as Record<string, string>).toString();

    return res.redirect(`https://${appUrl.replace('https://', '')}/#/payment/result?${query}`);
}

export { router as subscriptionRoutes }
