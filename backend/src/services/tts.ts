import { spawn } from "child_process";
import { InferType, mixed } from "yup";
import path from "path";
import { platform } from "os";
import fs from "fs";

export const languageSchema = mixed<'fa' | 'en' | 'de'>().oneOf(['fa', 'en', 'de']).required()
export type Language = InferType<typeof languageSchema>

export function getSampleRate(language: Language) {
    let fileName
    switch (language) {
        case 'de':
            fileName = 'de_DE-thorsten-high.onnx.json'
            break;

        case 'en':
            fileName = 'en_US-lessac-high.onnx.json'
            break;

        default:
            break;
    }

    const file: string = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'voices', 'de_DE-thorsten-high.onnx.json'), { encoding: 'utf8' })
    if (typeof file !== 'string')
        throw new Error('Failed to find sample rate.')

    return JSON.parse(file).audio.sample_rate
}

export function getTTSAudioStream(lang: Language) {
    const voicesDirectory = path.join(process.cwd(), 'src', 'services', 'voices')

    const model = lang === "de"
        ? path.join(voicesDirectory, "de_DE-thorsten-high.onnx")
        : path.join(voicesDirectory, "en_US-lessac-high.onnx")

    const platformName = platform();
    let executable
    if (platformName === 'win32')
        executable = path.join(process.cwd(), 'src', 'piper', 'windows', 'piper.exe')
    else
        executable = path.join(process.cwd(), 'src', 'piper', 'linux', 'piper')

    return spawn(executable, ["--model", model, "--output-raw",])
}
