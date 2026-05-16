import type { ColorModes } from "./index.d"
import { IColor } from "./IColor"
import { HSL } from "./HSL"
import { HSV } from "./HSV"
import { RGB } from "./RGB"

export class ColorStatic {
    static toColorMode(mode: 'hex', color: IColor): string
    static toColorMode(mode: Omit<ColorModes, 'hex'>, color: IColor): IColor
    static toColorMode(mode: ColorModes, color: IColor): IColor | string {
        switch (mode) {
            case 'hsl':
                return color.toHsl()
            case 'hsla':
                return color.toHsl()
            case 'rgb':
                return color.toRgb()
            case 'rgba':
                return color.toRgb()
            case 'hsv':
                return color.toHsv()
            case 'hsva':
                return color.toHsv()
            case 'hex':
                return color.toHex()
            default:
                throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);
        }
    }

    static parse(color: string): IColor {
        if (typeof color !== 'string')
            throw new Error('Invalid argument provided to method ColorStatic.parse');

        if (color.charAt(0) === '#')
            return RGB.fromHex(color)

        const marker = color.indexOf('(');

        const type = color.substring(0, marker);
        if (['rgb', 'rgba', 'hsl', 'hsla', 'hsv', 'hsva'].indexOf(type) === -1)
            throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);

        if (type.includes('rgb'))
            return RGB.parse(color)

        if (type.includes('hsl'))
            return HSL.parse(color)

        if (type.includes('hsv'))
            return HSV.parse(color)

        throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);
    }

    static toRgb(color: IColor): RGB {
        if (color instanceof RGB)
            return color

        if (color instanceof HSL) {
            let h = color.getHue(), s = color.getSaturation(), l = color.getLightness()
            h /= 360
            s /= 100
            l /= 100

            let r, g, b
            if (s === 0)
                r = g = b = l // achromatic
            else {
                const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1
                    if (t > 1) t -= 1
                    if (t < 1 / 6) return p + (q - p) * 6 * t
                    if (t < 1 / 2) return q
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
                    return p
                }
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s
                const p = 2 * l - q
                r = hue2rgb(p, q, h + 1 / 3)
                g = hue2rgb(p, q, h)
                b = hue2rgb(p, q, h - 1 / 3)
            }

            return new RGB(r * 255, g * 255, b * 255, color.getAlpha())
        }

        if (color instanceof HSV) {
            let h = color.getHue(), s = color.getSaturation(), v = color.getValue()
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
            return new RGB(r!, g!, b!, color.getAlpha())
        }

        throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);
        // return RGB.fromHex(color.toHex()) as RGB
    }

    static toHsl(color: IColor): HSL {
        if (color instanceof HSL)
            return color

        if (color instanceof RGB) {
            let r = color.getRed(), g = color.getGreen(), b = color.getBlue()
            // Make r, g, and b fractions of 1
            r /= 255;
            g /= 255;
            b /= 255;

            // Find greatest and smallest channel values
            let cmin = Math.min(r, g, b),
                cmax = Math.max(r, g, b),
                delta = cmax - cmin, h = 0, s = 0, l = 0

            // Calculate hue
            // No difference
            if (delta === 0)
                h = 0
            // Red is max
            else if (cmax === r)
                h = ((g - b) / delta) % 6
            // Green is max
            else if (cmax === g)
                h = (b - r) / delta + 2
            // Blue is max
            else
                h = (r - g) / delta + 4

            h = Math.round(h * 60)

            // Make negative hues positive behind 360°
            if (h < 0)
                h += 360

            // Calculate lightness
            l = (cmax + cmin) / 2

            // Calculate saturation
            s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

            // Multiply l and s by 100
            s = +(s * 100).toFixed(1)
            l = +(l * 100).toFixed(1)

            return new HSL(h, s, l, color.getAlpha())
        }

        if (color instanceof HSV) {
            let h = color.getHue(), s = color.getSaturation(), v = color.getValue()
            let l = v - v * s / 2
            let m = Math.min(l, 1 - l)
            return new HSL(h, m ? (v - l) / m : 0, l, color.getAlpha())
        }

        throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);
    }

    static toHsv(color: IColor): HSV {
        if (color instanceof HSV)
            return color

        if (color instanceof HSL) {
            let h = color.getHue(), s = color.getSaturation(), l = color.getLightness()
            let v = s * Math.min(l, 1 - l) + l
            return new HSV(h, v ? 2 - 2 * l / v : 0, v, color.getAlpha())
        }

        if (color instanceof RGB) {
            let r = color.getRed(), g = color.getGreen(), b = color.getBlue()

            let max = Math.max(r, g, b)
            let min = Math.min(r, g, b)
            let d = max - min
            let h
            let s = (max === 0 ? 0 : d / max)
            let v = max / 255

            switch (max) {
                case min: h = 0
                    break
                case r: h = (g - b) + d * (g < b ? 6 : 0); h /= 6 * d
                    break
                case g: h = (b - r) + d * 2; h /= 6 * d
                    break
                case b: h = (r - g) + d * 4; h /= 6 * d
                    break
            }

            return new HSV(h! * 360, s * 100, v * 100)
        }

        throw new Error(`Unsupported color. The following formats are supported: #nnn, #nnnnnn, rgb(), rgba(), hsl(), hsla(), hsv(), hsva().`);
    }
}
