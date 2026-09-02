interface IPay {
    request(amount: number, callbackUrl: string): Promise<false | { redirectUrl: string }>
    verify(params: any): Promise<false | { refId: string, cardNumber?: string, cardNumberHash?: string }>
    reverse(params: any): Promise<boolean>
}