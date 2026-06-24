import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { pipeline, Readable, Writable, PassThrough } from "stream";
import { platform } from "os";
import path from "path";
import fs from "fs";
import os from "os";
import { promises as fsp } from "fs";


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

// ---------------------------------------------------------------- Generated by Cloude ai ---------------------------------------------------------------- START
export interface HlsSegmentOutput {
    index: number;
    filename: string;     // e.g. "segment_000004.ts"
    stream: Readable;      // segment bytes, ready to pipe/consume
}

export interface DecodeStreamHlsToRamOptions {
    title: string;
    input: Buffer | Readable;
    maxFileSize: number;
    segmentSeconds?: number;
    /** Directory backed by tmpfs (Linux/Mac) — see setup notes below. Falls back to OS temp dir if not tmpfs/not Linux. */
    ramDir?: string;
    onSegment: (seg: HlsSegmentOutput) => void;
    onPlaylist?: (m3u8Contents: string, isFinal: boolean) => void;
}

// Picks a RAM-backed working dir if available, otherwise OS temp dir.
function resolveWorkDir(preferred?: string): string {
    if (preferred && fs.existsSync(preferred)) return preferred;
    // Common tmpfs mount points if the caller didn't set one up explicitly.
    const candidates = platform() === "win32" ? [] : ["/dev/shm", "/run/shm"];
    for (const c of candidates)
        if (fs.existsSync(c)) return c;
    return fs.mkdtempSync(path.join(os.tmpdir(), "hls-"));
}

export function decodeVideoStreamToRamSegments(opts: DecodeStreamHlsToRamOptions): Promise<void> {
    const { input, maxFileSize, onSegment, onPlaylist, title } = opts;
    const segmentSeconds = opts.segmentSeconds ?? 5;

    return new Promise(async (resolve, reject) => {
        let settled = false;
        const settle = (err?: Error) => {
            if (settled) return;
            settled = true;
            cleanupWatcher();
            err ? reject(err) : resolve();
        };

        const baseDir = resolveWorkDir(opts.ramDir);
        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "_");
        const jobDir = path.join(baseDir, `job-${safeTitle}`);
        await fsp.mkdir(jobDir, { recursive: true });

        const platformName = platform();
        const ffmpegPath = platformName === "win32" ? path.join(process.cwd(), "src", "ffmpeg-8.1-essentials_build", "bin", "ffmpeg.exe") : path.join(process.cwd(), "src", "ffmpeg-7.0.2-amd64-static", "ffmpeg");

        const segmentPattern = path.join(jobDir, "segment_%06d.ts");
        const playlistPath = path.join(jobDir, "index.m3u8");

        const ffmpeg = spawn(ffmpegPath, [
            "-probesize", "10M",
            "-i", "pipe:0",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-f", "hls",
            "-hls_time", String(segmentSeconds),
            "-hls_list_size", "0",
            "-hls_segment_filename", segmentPattern,
            playlistPath,
        ]);

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

        // ---- watch jobDir for finished segment files ----
        // A segment is "finished" once ffmpeg starts writing the NEXT one
        // (or the process exits). We track known files and emit/cleanup the
        // previous one once a newer one appears, to avoid reading a
        // still-being-written file.
        const emitted = new Set<string>();
        let watcher: fs.FSWatcher | null = null;
        let ffmpegExited = false;

        const cleanupWatcher = () => {
            watcher?.close();
            watcher = null;
        };

        const segmentIndexFromName = (name: string): number => {
            const m = name.match(/segment_(\d+)\.ts$/);
            return m ? parseInt(m[1], 10) : -1;
        };

        const emitAndDelete = async (name: string) => {
            if (emitted.has(name)) return;
            emitted.add(name);
            const fullPath = path.join(jobDir, name);
            try {
                const data = await fsp.readFile(fullPath); // small file (~5s of video), fine to buffer
                const stream = new PassThrough();
                stream.end(data);
                onSegment({ index: segmentIndexFromName(name), filename: name, stream });
            } catch (e) {
                console.error(`[ram-hls] failed reading segment ${name}`, e);
            } finally {
                // Delete immediately after handing off — this is what keeps
                // memory usage bounded regardless of total video length.
                fsp.unlink(fullPath).catch(() => { });
            }
        };

        const emitPlaylistIfPresent = async (isFinal: boolean) => {
            if (!onPlaylist) return;
            try {
                const contents = await fsp.readFile(playlistPath, "utf8");
                onPlaylist(contents, isFinal);
            } catch {
                // playlist may not exist yet on the very first events
            }
        };

        const checkForNewSegments = async () => {
            let names: string[];
            try {
                names = await fsp.readdir(jobDir);
            } catch {
                return;
            }
            const segmentFiles = names
                .filter((n) => /^segment_\d+\.ts$/.test(n))
                .sort();

            // Everything except the most recently created segment is safe to
            // treat as "finished" (ffmpeg has moved on to writing a newer one).
            const safeToEmit = ffmpegExited ? segmentFiles : segmentFiles.slice(0, -1);
            for (const name of safeToEmit) {
                await emitAndDelete(name);
            }
            await emitPlaylistIfPresent(ffmpegExited);
        };

        try {
            watcher = fs.watch(jobDir, { persistent: true }, () => {
                checkForNewSegments().catch((e) => console.error("[ram-hls watch]", e));
            });
        } catch (e) {
            settle(e as Error);
            return;
        }

        ffmpeg.on("close", async (code) => {
            ffmpegExited = true;
            await checkForNewSegments(); // flush the final segment + final playlist
            cleanupWatcher();
            await fsp.rm(jobDir, { recursive: true, force: true }).catch(() => { });

            if (code !== 0) {
                const stderrOutput = Buffer.concat(stderrChunks).toString();
                console.error(`[ffmpeg] exited with code ${code}:\n${stderrOutput}`);
                settle(new Error(`FFmpeg exited with code ${code}`));
            } else {
                settle();
            }
        });

        // ---- stdin feeding (same as before) ----
        if (ffmpeg.stdin.destroyed) {
            settle(new Error("ffmpeg stdin destroyed before use"));
            return;
        }

        if (Buffer.isBuffer(input)) {
            ffmpeg.stdin.write(input);
            ffmpeg.stdin.end();
        } else {
            let total = 0;
            let sizeLimitExceeded = false;
            input.on("data", (chunk: Buffer) => {
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

        ffmpeg.stdin.on("error", (e) => {
            console.error("[ffmpeg stdin]", e);
        });
    });
}
// ---------------------------------------------------------------- Generated by Cloude ai ---------------------------------------------------------------- END
