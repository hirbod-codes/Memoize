import { httpsRequest } from "../../../utils";
import { getLogger, runWithLogger } from "../../../observability/requestLoggerContext";
import { validate } from "../../../lib";
import { verifySchema, reverseSchema } from "./schemas";

export class Zibal implements IPay {
    baseEndpoint: string
    merchantId: string

    constructor(baseEndpoint: string, merchantId: string) {
        this.merchantId = merchantId
        this.baseEndpoint = baseEndpoint
    }

    async request(amount: number, callbackUrl: string) {
        const log = getLogger().child({ step: 'request' });

        try {
            const result = await httpsRequest(
                { host: `${this.baseEndpoint.replace('https://', '')}`, path: 'v1/request/lazy', method: 'post', headers: { 'content-type': 'application/json', accept: 'application/json' } },
                JSON.stringify({
                    // merchant_id: this.merchantId,
                    merchant_id: 'zibal',
                    amount,
                    callback_url: callbackUrl,
                    description: 'Plan payment',
                    feeMode: 0
                })
            )
            if (!result.response.statusCode || result.response.statusCode < 200 || result.response.statusCode >= 300) {
                log.error({ statusCode: result.response.statusCode }, 'sending request to zibal `v1/request` endpoint failed')
                return false
            }

            const data = JSON.parse(result.data) as {
                data: {
                    trackId: string,
                    result: number,
                    message: string
                }
            }
            log.debug({ data })

            const { data: { result: resultCode, trackId } } = data

            if (resultCode !== 100) {
                log.error({ resultCode }, 'request from zibal `v1/request` endpoint, responded with errors')
                return false
            }

            return { redirectUrl: `${this.baseEndpoint}/start/${trackId}` }
        } catch (error) {
            log.error({ error }, 'requesting payment failed with error')
            return false
        }
    }

    async verify(params: any) {
        const log = getLogger().child({ step: 'verify' });

        try {
            const { trackId, amount } = await runWithLogger(log, () => validate(verifySchema, params))

            const zibalResult = await httpsRequest(
                { host: `${this.baseEndpoint.replace('https://', '')}`, path: 'verify', method: 'post', headers: { 'content-type': 'application/json', accept: 'application/json' } },
                JSON.stringify({
                    // merchant_id: this.merchantId,
                    merchant_id: 'zibal',
                    amount,
                    trackId
                })
            )
            if (!zibalResult.response.statusCode || zibalResult.response.statusCode < 200 || zibalResult.response.statusCode >= 300) {
                log.error({ statusCode: zibalResult.response.statusCode }, 'sending request to zibal `verify` endpoint failed')
                return false
            }

            const responseData = JSON.parse(zibalResult.data) as {
                result: number,
                status: number,
                refNumber: number,
            }
            log.debug({ responseData })

            const { result, status, refNumber } = responseData

            if (result !== 100 || (status !== 1 && status !== 2)) {
                log.error({ result, status }, 'request from zibal `verify` endpoint, responded with errors')
                return false
            }

            return { refId: refNumber }
        } catch (error) {
            log.error({ error }, 'verifying payment failed with error')
            return false
        }
    }

    async reverse(params: any): Promise<boolean> {
        const log = getLogger().child({ step: 'reverse' });

        try {
            const { trackId } = await runWithLogger(log, () => validate(reverseSchema, params))

            const result = await httpsRequest(
                { host: `${this.baseEndpoint.replace('https://', '')}`, path: 'pg/v4/payment/reverse.json', method: 'post', headers: { 'content-type': 'application/json', accept: 'application/json' } },
                JSON.stringify({
                    // merchant_id: this.merchantId,
                    merchant_id: 'zibal',
                    trackId
                })
            )
            if (!result.response.statusCode || result.response.statusCode < 200 || result.response.statusCode >= 300) {
                log.error({ statusCode: result.response.statusCode }, 'sending request to zibal `pg/v4/payment/reverse.json` endpoint failed')
                return false
            }

            const responseData = JSON.parse(result.data) as {
                data: {
                    code: number,
                    message: string
                },
                errors: []
            }
            log.debug({ responseData })

            const { data: { code }, errors } = responseData

            if (!errors || errors.length !== 0 || code !== 100) {
                log.error({ errors }, 'request from zibal `pg/v4/payment/reverse.json` endpoint, responded with errors')
                return false
            }

            return true
        } catch (error) {
            log.error({ error }, 'reversing payment failed with error')
            return false
        }
    }
}
