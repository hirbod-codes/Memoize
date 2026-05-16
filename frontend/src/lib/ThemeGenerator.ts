import { argbFromHex, hexFromArgb, themeFromSourceColor, TonalPalette } from "@material/material-color-utilities"

const theme = themeFromSourceColor(argbFromHex("#769cdf"));
let l: any = theme.schemes.light.toJSON()
let lightTheme: any = l
Object.keys(l).forEach((k) => { lightTheme[k] = hexFromArgb(l[k]) })
console.log(theme, lightTheme)

const successPalette = TonalPalette.fromInt(argbFromHex("#22c55e")); // green
const warningPalette = TonalPalette.fromInt(argbFromHex("#f59e0b")); // amber

console.log({ s: hexFromArgb(successPalette.tone(80)), son: hexFromArgb(successPalette.tone(20)), w: hexFromArgb(warningPalette.tone(80)), won: hexFromArgb(warningPalette.tone(20)) })
