import { HSL } from "./HSL";
import { HSV } from "./HSV";
import { RGB } from "./RGB";

export type IColor = {
    /**
     * @param shade number between 0 and 100
     */
    shadeColor(shade: number): void;
    darken(coefficient: number): void;
    lighten(coefficient: number): void;
    toString(): string;
    toHex(): string;
    toRgb(): RGB;
    toHsl(): HSL;
    toHsv(): HSV;
}

export namespace IColor {
    export declare function fromHex(color: string): IColor;
    export declare function parse(color: string): IColor;
}
