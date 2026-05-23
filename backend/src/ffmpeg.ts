import { spawn } from "child_process";
import { platform } from "os";
import fs from "fs";
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

export function decodeVideoStreamToDisk(input: Buffer | Readable, format: string, maxFileSize: number, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const platformName = platform();
        let filePath
        if (platformName === 'win32')
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
        else
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg')

        const errorLogsStream = fs.createWriteStream('ffmpeg-errors.log')
        const logsStream = fs.createWriteStream('ffmpeg.log')

        const ffmpeg = spawn(filePath, [
            "-f", format,
            "-i", 'pipe:0',
            "-c:v", 'libx264',
            "-c:a", 'aac',
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_segment_filename", path.join(outputDirectory, 'segment_%06d.ts'),
            path.join(outputDirectory, 'index.m3u8')
        ]);

        const chunks: Buffer[] = [];

        ffmpeg.stdout.on("data", (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stdout.on("error", (e) => {
            console.error(e);
        });

        ffmpeg.stderr.on("data", (data) => {
            console.error('[ffmpeg]', data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`FFmpeg exited with code ${code}`));
            }

            resolve();
        });

        ffmpeg.on("error", (e) => {
            console.log(e);
            reject(e)
        });

        ffmpeg.stderr.pipe(errorLogsStream)

        ffmpeg.stdout.pipe(logsStream)


        // Feed input
        if (!ffmpeg.stdin.destroyed) {
            if (Buffer.isBuffer(input)) {
                ffmpeg.stdin.write(input);
                ffmpeg.stdin.end();
            } else {
                let total = 0;

                input.on("data", (chunk) => {
                    total += chunk.length;

                    if (total > maxFileSize) {
                        console.log('File size too large...')
                        ffmpeg.kill("SIGKILL");
                        input.destroy();

                        return;
                    }

                    ffmpeg.stdin.write(chunk);
                })

                input.on("end", () => {
                    ffmpeg.stdin.end();
                })

                input.pipe(ffmpeg.stdin);
            }
        }
    });
}

export function generateThumbnailFromVideoFileToDisk(input: string, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const platformName = platform();
        let filePath
        if (platformName === 'win32')
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
        else
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg')

        const errorLogsStream = fs.createWriteStream('ffmpeg-errors.log')
        const logsStream = fs.createWriteStream('ffmpeg.log')

        const ffmpeg = spawn(filePath, [
            "-i", input,
            "-ss", "00:00:00.5",
            "-frames:v", "1",
            "-q:v", "2",
            path.join(outputDirectory, 'thumbnail.jpg')
        ]);

        const chunks: Buffer[] = [];

        ffmpeg.stdout.on("data", (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stdout.on("error", (e) => {
            console.error(e);
        });

        ffmpeg.stderr.on("data", (data) => {
            console.error('[ffmpeg]', data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`FFmpeg exited with code ${code}`));
            }

            resolve();
        });

        ffmpeg.on("error", (e) => {
            console.log(e);
            reject(e)
        });

        ffmpeg.stderr.pipe(errorLogsStream)

        ffmpeg.stdout.pipe(logsStream)
    });
}

export function decodeVideoFileToDisk(input: string, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const platformName = platform();
        let filePath
        if (platformName === 'win32')
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
        else
            filePath = path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg')

        const errorLogsStream = fs.createWriteStream('ffmpeg-errors.log')
        const logsStream = fs.createWriteStream('ffmpeg.log')

        const ffmpeg = spawn(filePath, [
            "-i", input,
            "-c:v", 'libx264',
            "-c:a", 'aac',
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_segment_filename", path.join(outputDirectory, 'segment_%06d.ts'),
            path.join(outputDirectory, 'index.m3u8')
        ]);

        spawn(filePath, [
            "-i", input,
            "-ss", "00:00:00.5",
            "-frames:v", "1",
            "-q:v", "2",
            path.join(outputDirectory, 'thumbnail.jpg')
        ]);

        const chunks: Buffer[] = [];

        ffmpeg.stdout.on("data", (chunk) => {
            chunks.push(chunk);
        });

        ffmpeg.stdout.on("error", (e) => {
            console.error(e);
        });

        ffmpeg.stderr.on("data", (data) => {
            console.error('[ffmpeg]', data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`FFmpeg exited with code ${code}`));
            }

            resolve();
        });

        ffmpeg.on("error", (e) => {
            console.log(e);
            reject(e)
        });

        ffmpeg.stderr.pipe(errorLogsStream)

        ffmpeg.stdout.pipe(logsStream)
    });
}