export interface IOtp {
    sendVerificationMessage(code: string, toPhoneNumber: string, locale: 'en' | 'fa'): Promise<boolean>;
}
