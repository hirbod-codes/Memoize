export interface ISmtp {
    sendVerificationMessage(code: string, toPhoneNumber: string, locale: 'en' | 'fa'): Promise<boolean>;
}
