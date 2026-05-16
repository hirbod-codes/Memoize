import { ColorStatic } from "./ColorStatic"
import { IColor } from "./IColor"

export function validateColor(color: string | IColor | string): string {
    if (typeof color !== 'string')
        return color.toHex()
    else
        return ColorStatic.parse(color).toHex()
}
