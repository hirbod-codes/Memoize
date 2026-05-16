import { EQ_PRESETS, type EQPresetName } from "./EQPresets";
import { HybridAudioEngine } from "./HybridAudioEngine";

export type RepeatState = 'no-repeat' | 'repeat' | 'self-repeat';

export type Listener = () => void;

export class AudioManager {
    private engine = new HybridAudioEngine();

    private listeners = new Set<Listener>();

    private playlist: string[] = [];
    index = 0;

    state = {
        audioId: null as string | null,
        isPlaying: false,
        loaded: false,
        current: 0,
        duration: 0,
        volume: 1,
        repeat: 'no-repeat' as RepeatState,
        equalizer: {
            enabled: false,
            preamp: 1,
            bands: {
                "60": 0,
                "170": 0,
                "310": 0,
                "600": 0,
                "1000": 0,
                "3000": 0,
                "6000": 0,
                "12000": 0,
                "14000": 0,
                "16000": 0,
            }
        },
    };

    constructor() {
        this.engine.onTimeUpdate(() => {
            this.state.current = this.engine.currentTime;
            this.emit();
        });

        this.engine.onLoaded(() => {
            this.state.duration = this.engine.duration;
            this.state.loaded = true;
            this.emit();
        });

        this.engine.onEnded(() => {
            this.handleTrackEnd();
        });

        this.engine.setEqualizerEnabled(true);
    }

    setPlaylist(audioIds: string[], startIndex = 0) {
        this.playlist = audioIds;
        this.index = startIndex;
        while (this.index < this.playlist.length - 1 && this.playlist[this.index] === undefined)
            this.index++

        if (this.index >= this.playlist.length)
            return;

        this.loadCurrent();
    }

    private loadCurrent() {
        const id = this.playlist[this.index];
        if (!id) return;

        this.state.audioId = id;
        this.state.loaded = false;
        this.state.current = 0;

        this.engine.load(`/api/audio/file/${id}`);
        this.emit();
    }

    async next() {
        if (this.playlist.length === 0)
            return;

        do {
            this.index++;

            if (this.index >= this.playlist.length) {
                if (this.state.repeat !== 'repeat')
                    return;

                this.index = 0;
            }
        } while (this.playlist[this.index] === undefined);

        this.loadCurrent();
        await this.play();
    }

    async previous() {
        if (this.playlist.length === 0) return;

        if (this.state.current > 3) {
            this.seek(0);
            return;
        }

        if (this.index > 0) {
            this.index--;
            this.loadCurrent();
            await this.play();
        }
    }

    async jumpTo(index: number) {
        if (this.playlist.length === 0)
            return;

        if (index < 0 || index >= this.playlist.length)
            return;

        if (this.playlist[index] === undefined)
            return;

        if (this.index === index) {
            await this.seek(0);

            if (!this.state.isPlaying)
                await this.play();

            return;
        }

        this.index = index;

        this.loadCurrent();

        await this.play();
    }

    private async handleTrackEnd() {
        if (this.state.repeat === 'self-repeat') {
            await this.seek(0);
            await this.play();
            return;
        }

        const previousIndex = this.index;

        this.next();

        // reached end without advancing
        if (previousIndex === this.index) {
            this.state.isPlaying = false;
            this.emit();
        }
    }

    async play() {
        await this.engine.play();
        this.state.isPlaying = true;
        this.emit();
    }

    pause() {
        this.engine.pause();
        this.state.isPlaying = false;
        this.emit();
    }

    async toggle() {
        if (this.state.isPlaying)
            this.pause();
        else
            await this.play();
    }

    async seek(time: number) {
        await this.engine.seek(time);
        this.state.current = time;
        this.emit();
    }

    setVolume(v: number) {
        v = Math.max(0, Math.min(1, v));

        this.engine.setVolume(v);
        this.state.volume = v;
        this.emit();
    }

    setRepeat(r: RepeatState) {
        this.state.repeat = r;
        this.emit();
    }

    subscribe(fn: Listener) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn) };
    }

    private emit() {
        this.listeners.forEach(fn => fn());
    }

    setEqualizerEnabled(enabled: boolean) {
        this.engine.setEqualizerEnabled(enabled);

        this.state.equalizer.enabled = enabled;

        this.emit();
    }

    setPreamp(value: number) {
        this.engine.setPreamp(value);

        this.state.equalizer.preamp = value;

        this.emit();
    }

    setEQBand(frequency: keyof typeof this.state.equalizer.bands, gain: number) {
        gain = Math.max(-12, Math.min(12, gain));

        this.engine.setEQBand(Number(frequency), gain);

        this.state.equalizer.bands[frequency] = gain;

        this.emit();
    }

    resetEqualizer() {
        this.engine.resetEqualizer();

        this.state.equalizer = {
            enabled: false,
            preamp: 1,
            bands: {
                "60": 0,
                "170": 0,
                "310": 0,
                "600": 0,
                "1000": 0,
                "3000": 0,
                "6000": 0,
                "12000": 0,
                "14000": 0,
                "16000": 0,
            }
        };

        this.emit();
    }

    setEqualizerPreset(preset: Partial<typeof this.state.equalizer.bands>) {
        Object.entries(preset).forEach(([freq, gain]) => {
            this.engine.setEQBand(Number(freq), gain!);

            this.state.equalizer.bands[
                freq as keyof typeof this.state.equalizer.bands
            ] = gain!;
        });

        this.emit();
    }

    applyPreset(name: EQPresetName) {
        this.setEqualizerPreset(EQ_PRESETS[name]);
    }
}

export const audioManager = new AudioManager();
