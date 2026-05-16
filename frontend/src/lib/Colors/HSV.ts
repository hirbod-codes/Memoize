import { Color } from "./Color"
import { HSL } from "./HSL"
import { IColor } from "./IColor"
import { RGB } from "./RGB"

export class HSV extends Color implements IColor {
    private hue: number
    private saturation: number
    private value: number

    constructor(hue: number, saturation: number, value: number, alpha?: number) {
        super(alpha)

        if (![saturation, value].every(v => v >= 0 && v <= 100) || hue < 0 || hue > 360)
            throw new Error('Invalid color values provided.')

        this.hue = hue
        this.saturation = saturation
        this.value = value
    }

    getHue() { return this.hue }
    getSaturation() { return this.saturation }
    getValue() { return this.value }

    setHue(v: number) { this.hue = v }
    setSaturation(v: number) { this.saturation = v }
    setValue(v: number) { this.value = v }

    shadeColor(shade: number): void {
        const mid = Math.floor(100 / 2)

        if (shade >= mid)
            this.lighten((shade - mid) / mid)
        else
            this.darken(1 - (shade / mid))
    }

    lighten(coefficient: number): void {
        let rgb = this.toRgb()
        rgb.lighten(coefficient)

        let hsv = rgb.toHsv()

        this.hue = hsv.getHue()
        this.saturation = hsv.getSaturation()
        this.value = hsv.getValue()
    }

    darken(coefficient: number): void {
        let rgb = this.toRgb()
        rgb.darken(coefficient)

        let hsv = rgb.toHsv()

        this.hue = hsv.getHue()
        this.saturation = hsv.getSaturation()
        this.value = hsv.getValue()
    }

    toString(): string {
        return `${this.alpha !== undefined ? 'hsva' : 'hsv'}(${this.hue.toFixed(2)}, ${this.saturation.toFixed(2)}%, ${this.value.toFixed(2)}%${this.alpha !== undefined ? ', ' + this.alpha.toFixed(2) : ''})`
    }

    toRgb(): RGB {
        let h = this.hue / 360, s = this.saturation / 100, v = this.value / 100
        let r, g, b, i, f, p, q, t;

        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        r! *= 255
        g! *= 255
        b! *= 255
        return new RGB(r!, g!, b!, this.getAlpha())
    }

    toHsl(): HSL {
        const h = this.getHue();
        const s = this.getSaturation() / 100;
        const v = this.getValue() / 100;
        const vmin = Math.max(v, 0.01);
        let sl;
        let l;

        l = (2 - s) * v;
        const lmin = (2 - s) * vmin;
        sl = s * vmin;
        sl /= (lmin <= 1) ? lmin : 2 - lmin;
        sl = sl || 0;
        l /= 2;

        return new HSL(h, sl * 100, l * 100, this.getAlpha())
    }

    toHsv(): HSV {
        return this
    }

    toHex(): string {
        return this.toRgb().toHex()
    }

    static fromHex(color: string): IColor {
        const rgb = RGB.fromHex(color) as RGB
        return rgb.toHsv()
    }

    static parse(color: string): IColor {
        const marker = color.indexOf('(');
        const type = color.substring(0, marker);
        if (!type.startsWith('hsv'))
            throw new Error('Invalid input provided for parse method of HSV class');

        let hsla = color.substring(marker + 1, color.length - 1).split(',').map(value => parseFloat(value.replace('%', '')))

        return new HSV(hsla[0], hsla[1], hsla[2], hsla[3])
    }
}
