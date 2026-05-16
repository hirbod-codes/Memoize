export class Color {
    protected alpha: number | undefined

    constructor(alpha = 1) {
        if (alpha !== undefined && (alpha < 0 || alpha > 1))
            throw new Error('Invalid color values provided.')

        this.alpha = alpha
    }

    getAlpha() { return this.alpha }
    setAlpha(v: number) { this.alpha = v }
}
