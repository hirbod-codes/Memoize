import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { platform } from "os";
import path from "path";
import { pipeline, Readable, Writable } from "stream";

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

export function decodePCMStreamToOutputStream(sampleRate: string, input: ChildProcessWithoutNullStreams, output: Writable, maxFileSize: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (err?: Error) => {
            if (settled) return;
            settled = true;
            err ? reject(err) : resolve();
        };

        const platformName = platform();
        const executable = platformName === 'win32'
            ? path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
            : path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg');

        const ffmpeg = spawn(executable, [
            "-f", "s16le",
            "-ar", sampleRate,
            "-ac", "1",
            "-i", "pipe:0",
            "-f", "wav",
            "pipe:1",
        ]);

        // Error handlers
        const stderrChunks: Buffer[] = [];
        ffmpeg.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        ffmpeg.on("error", (e) => {
            console.error("[ffmpeg process]", e)
            settle(e);
        });
        ffmpeg.stdout.on("error", (e) => {
            console.error("[ffmpeg stdout]", e)
            settle(e)
        })

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                const stderrOutput = Buffer.concat(stderrChunks).toString();
                console.error(`[ffmpeg] exited with code ${code}:\n${stderrOutput}`);

                settle(new Error(`FFmpeg exited with code ${code}`))
            } else
                settle();
        });

        if (ffmpeg.stdin.destroyed)
            return settle(new Error("ffmpeg stdin destroyed before use"))

        let total = 0;
        let sizeLimitExceeded = false;
        input.stdout.on("data", (chunk) => {
            total += chunk.length;
            if (!sizeLimitExceeded && total > maxFileSize) {
                sizeLimitExceeded = true

                console.error(`[size] Limit exceeded (${total} bytes), killing ffmpeg...`)

                ffmpeg.kill("SIGKILL")
                input.stdout.destroy()

                settle(new Error(`File size exceeded limit of ${maxFileSize} bytes`))
            }
        });

        // Error handlers
        input.stderr.on("data", (data) => {
            console.error("[piper]", data.toString())
        });
        input.on("error", (e) => {
            console.error("[piper process]", e)
            settle(e);
        });

        pipeline(input.stdout, ffmpeg.stdin, (err) => {
            if (err && !sizeLimitExceeded) {
                console.error("[pipeline]", err)
                settle(err)
            }
        });

        ffmpeg.stdout.pipe(output)
    });
}

export function decodeVideoStreamToDisk(input: Buffer | Readable, format: string, maxFileSize: number, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (err?: Error) => {
            if (settled) return;
            settled = true;
            err ? reject(err) : resolve();
        };

        const platformName = platform();
        const filePath = platformName === 'win32'
            ? path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
            : path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg');

        const ffmpeg = spawn(filePath, [
            "-f", format,
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_segment_filename", path.join(outputDirectory, "segment_%06d.ts"),
            path.join(outputDirectory, "index.m3u8"),
        ]);

        // Error handlers
        const stderrChunks: Buffer[] = [];
        ffmpeg.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        ffmpeg.on("error", (e) => {
            console.error("[ffmpeg process]", e);
            settle(e);
        });
        ffmpeg.stdout.on("error", (e) => {
            console.error("[ffmpeg stdout]", e);
            settle(e);
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                const stderrOutput = Buffer.concat(stderrChunks).toString();
                console.error(`[ffmpeg] exited with code ${code}:\n${stderrOutput}`);
                settle(new Error(`FFmpeg exited with code ${code}`));
            } else
                settle();
        });

        if (ffmpeg.stdin.destroyed) {
            settle(new Error("ffmpeg stdin destroyed before use"));
            return;
        }

        // Feed input
        if (Buffer.isBuffer(input)) {
            ffmpeg.stdin.write(input);
            ffmpeg.stdin.end();
        } else {
            let total = 0;
            let sizeLimitExceeded = false;
            input.on("data", (chunk) => {
                total += chunk.length;
                if (sizeLimitExceeded) return;
                if (total > maxFileSize) {
                    sizeLimitExceeded = true;
                    console.error(`[size] Limit exceeded (${total} bytes), killing ffmpeg`);
                    ffmpeg.kill("SIGKILL");
                    input.destroy();
                    settle(new Error(`File size exceeded limit of ${maxFileSize} bytes`));
                    return;
                }
                ffmpeg.stdin.write(chunk);
            });

            input.on("end", () => ffmpeg.stdin.end());

            input.on("error", (e) => {
                console.error("[input stream]", e);
                settle(e);
            });
        }
    });
}

export function generateThumbnailFromVideoFileToDisk(input: string, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (err?: Error) => {
            if (settled) return;
            settled = true;
            err ? reject(err) : resolve();
        };

        const platformName = platform();
        const filePath = platformName === 'win32'
            ? path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
            : path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg');

        const ffmpeg = spawn(filePath, [
            "-i", input,
            "-ss", "00:00:00.5",
            "-frames:v", "1",
            "-q:v", "2",
            path.join(outputDirectory, 'thumbnail.jpg')
        ]);

        // Error handlers
        const stderrChunks: Buffer[] = [];
        ffmpeg.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        ffmpeg.on("error", (e) => {
            console.error("[ffmpeg process]", e);
            settle(e);
        });
        ffmpeg.stdout.on("error", (e) => {
            console.error("[ffmpeg stdout]", e);
            settle(e);
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                const stderrOutput = Buffer.concat(stderrChunks).toString();
                console.error(`[ffmpeg] exited with code ${code}:\n${stderrOutput}`);
                settle(new Error(`FFmpeg exited with code ${code}`));
            } else {
                settle();
            }
        });
    });
}

export function decodeVideoFileToDisk(input: string, outputDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (err?: Error) => {
            if (settled) return;
            settled = true;
            err ? reject(err) : resolve();
        };

        const platformName = platform();
        const filePath = platformName === 'win32'
            ? path.join(process.cwd(), 'src', 'ffmpeg-8.1-essentials_build', 'bin', 'ffmpeg.exe')
            : path.join(process.cwd(), 'src', 'ffmpeg-7.0.2-amd64-static', 'ffmpeg');

        const ffmpeg = spawn(filePath, [
            "-i", input,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-f", "hls",
            "-hls_time", "5",
            "-hls_list_size", "0",
            "-hls_segment_filename", path.join(outputDirectory, "segment_%06d.ts"),
            path.join(outputDirectory, "index.m3u8"),
        ]);

        // Error handlers
        const stderrChunks: Buffer[] = [];
        ffmpeg.stderr.on("data", (chunk) => stderrChunks.push(chunk));
        ffmpeg.on("error", (e) => {
            console.error("[ffmpeg process]", e);
            settle(e);
        });
        ffmpeg.stdout.on("error", (e) => {
            console.error("[ffmpeg stdout]", e);
            settle(e);
        });

        ffmpeg.on("close", (code) => {
            if (code !== 0) {
                const stderrOutput = Buffer.concat(stderrChunks).toString();
                console.error(`[ffmpeg] exited with code ${code}:\n${stderrOutput}`);
                settle(new Error(`FFmpeg exited with code ${code}`));
            } else {
                settle();
            }
        });
    });
}