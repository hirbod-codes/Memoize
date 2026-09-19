import { Zibal } from ".";
import { payments } from "../../../configs";

export class PaymentFactory {
    static instantiate(paymentMethod: string): IPay {
        switch (paymentMethod) {
            case 'zarinpal':
                return new Zibal(payments.zibal.url!, payments.zibal.merchantId!)

            default:
                throw new Error('UNSUPPORTED_PAYMENT_METHOD')
        }
    }
}
