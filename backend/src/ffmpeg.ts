import { spawn } from "child_process";
import { platform } from "os";
import path from "path";
import { Readable } from "stream";

export function decodeToPCM(input: Buffer | Readable): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
        const platformName = platform();
        let filePath
        if (platformName === 'win32')
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
        else
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg')

        const ffmpeg = spawn(filePath, [
            "-i", 'pipe:0',
            "-f", "f32le",     // read from stdin
            "-ac", "1",        // mono (important for analysis)
            "-ar", "44100",    // sample rate
            "pipe:1"           // output to stdout
        ]);

        const chunks: Buffer[] = [];

        ffmpeg.stdout.on("data", (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stderr.on("data", (data) => {
            // optional: log FFmpeg errors for debugging
            console.error(data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`FFmpeg exited with code ${code}`));
            }

            const buffer = Buffer.concat(chunks);

            const floatArray = new Float32Array(
                buffer.buffer,
                buffer.byteOffset,
                buffer.length / 4
            );

            resolve(floatArray);
        });

        ffmpeg.on("error", reject);

        // Feed input
        if (Buffer.isBuffer(input)) {
            ffmpeg.stdin.write(input);
            ffmpeg.stdin.end();
        } else {
            input.pipe(ffmpeg.stdin);
        }
    });
}

export function decodeVideoToDisk(input: Buffer | Readable, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const platformName = platform();
        let filePath
        if (platformName === 'win32')
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
        else
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg')

        const ffmpeg = spawn(filePath, [
            "-i", 'pipe:0',
            "-c:v", 'libx264',
            "-c:a", 'acc',
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_segment_filename", path.join(outputDirectory, 'segment_%06d.ts'),
            path.join(outputDirectory, 'index.m3u8')
        ]);

        const chunks: Buffer[] = [];

        ffmpeg
            .stdout.on("data", (chunk) => {
                chunks.push(chunk);
            });

        ffmpeg
            .stderr.on("data", (data) => {
                console.error('[ffmpeg]', data.toString());
            });

        ffmpeg
            .on("close", (code) => {
                if (code !== 0) {
                    return reject(new Error(`FFmpeg exited with code ${code}`));
                }

                resolve();
            });

        ffmpeg.on("error", reject);

        // Feed input
        if (Buffer.isBuffer(input)) {
            ffmpeg.stdin.write(input);
            ffmpeg.stdin.end();
        } else {
            input.pipe(ffmpeg.stdin);
        }
    });
}