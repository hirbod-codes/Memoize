import { Currency } from "../../DB/common_schemas";
import { PaymentMethod } from "../../DB/models/Subscription";

export function resolveCurrencyFromPaymentMethod(paymentMethod: PaymentMethod): Currency {
    switch (paymentMethod) {
        case 'zarinpal':
            return 'IRT'

        case 'zibal':
            return 'IRR'

        case 'paypal':
            return 'USD'

        case 'bitcoin':
            return 'BTC'

        default:
            throw new Error('UNSUPPORTED_PAYMENT_METHOD')
    }
}