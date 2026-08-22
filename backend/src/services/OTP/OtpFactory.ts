import { smsProvider } from "../../configs";
import { IOtp } from "./IOtp";
import { Melipayamak } from "./SmsProviders/melipayamak";

export class OtpFactory {
    static instantiate(): IOtp {
        return new Melipayamak({
            baseEndpoint: smsProvider.baseEndpoint,
            username: smsProvider.username,
            password: smsProvider.password,
            from: smsProvider.from,
            smsProviderVerificationMessageReferenceAddress: smsProvider.smsProviderVerificationMessageReferenceAddress
        })
    }
}