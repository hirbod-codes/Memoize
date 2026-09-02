import { Zarinpal } from ".";
import { payments } from "../../../configs";

export class PaymentFactory {
    static instantiate(paymentMethod: string): IPay {
        switch (paymentMethod) {
            case 'zarinpal':
                return new Zarinpal(payments.zarinpal.url!, payments.zarinpal.merchantId!)

            default:
                throw new Error('UNSUPPORTED_PAYMENT_METHOD')
        }
    }
}
