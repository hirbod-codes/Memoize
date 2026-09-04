import { smsProvider } from "../../configs";
import { ISmtp } from "./ISmtp";

export class SmtpFactory {
    static instantiate(): ISmtp {
        throw new Error('UNSUPPORTED_SMTP_PROVIDER')
    }
}
