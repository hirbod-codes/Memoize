import { InferType } from "yup"
import { ISchema } from "yup"
import { getLogger } from "../observability/requestLoggerContext";
import { Logger } from "pino";
import { Response } from "express";

export const A_MONTH_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000

export async function validate<T extends ISchema<any, any>>(schema: T, input: any): Promise<InferType<T>> {
    return await schema.validate(input)
}

export function handleError(res: Response, err: any, log?: Logger) {
    log = log ?? getLogger()

    if (err.name === 'ValidationError') {
        log.info({ errors: err.errors ?? err.message }, 'request input validation failed');
        try { return res.status(400).json({ status: 'error', error: err.message }); } catch (_) { }
    }

    log.error({ err }, 'Unhandled error');
    try { return res.status(500).json({ status: 'error', error: 'INTERNAL' }); } catch (_) { }
}
