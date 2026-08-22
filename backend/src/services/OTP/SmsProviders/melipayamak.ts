import { IOtp } from "../IOtp";

export class Melipayamak implements IOtp {
    private baseEndpoint: string
    private username: string
    private password: string
    private from: string
    private smsProviderVerificationMessageReferenceAddress: string

    constructor({ baseEndpoint, username, password, from, smsProviderVerificationMessageReferenceAddress }: { baseEndpoint: string, username: string, password: string, from: string, smsProviderVerificationMessageReferenceAddress: string }) {
        this.baseEndpoint = baseEndpoint
        this.username = username
        this.password = password
        this.from = from
        this.smsProviderVerificationMessageReferenceAddress = smsProviderVerificationMessageReferenceAddress
    }

    async sendVerificationMessage(code: string, toPhoneNumber: string, locale: 'en' | 'fa'): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseEndpoint}/SendSMS/SendSMS`, {
                method: 'post',
                body: JSON.stringify({
                    username: this.username,
                    password: this.password,
                    from: this.from,
                    text: locale === 'en'
                        ? `Your Memoize verification code is ${code}`
                        : `کد ورود شما: 
    ${code}
    @${this.smsProviderVerificationMessageReferenceAddress} #${code}`
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            })

            if (response.ok)
                return true

            return false
        } catch (error) {
            console.error(error);
            return false
        }
    }
}
