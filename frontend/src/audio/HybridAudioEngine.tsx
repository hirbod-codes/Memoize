export class HybridAudioEngine {
    private audio = new Audio();
    private ctx = new AudioContext();

    private sourceNode: MediaElementAudioSourceNode;
    private analyser: AnalyserNode;
    private gain: GainNode;

    private filters = new Map<number, BiquadFilterNode>();
    private preamp: GainNode;
    private equalizerEnabled = true;

    constructor() {
        this.sourceNode = this.ctx.createMediaElementSource(this.audio);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        this.preamp = this.ctx.createGain();
        this.gain = this.ctx.createGain();
        const frequencies = [
            60,
            170,
            310,
            600,
            1000,
            3000,
            6000,
            12000,
            14000,
            16000,
        ];

        frequencies.forEach(freq => {
            const filter = this.ctx.createBiquadFilter();

            filter.type = "peaking";
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;

            this.filters.set(freq, filter);
        });

        this.rebuildAudioGraph();
    }

    private rebuildAudioGraph() {
        this.sourceNode.disconnect();
        this.analyser.disconnect();
        this.preamp.disconnect();
        this.gain.disconnect();

        this.filters.forEach(filter => {
            filter.disconnect();
        });

        this.sourceNode.connect(this.analyser);

        if (!this.equalizerEnabled) {
            this.analyser.connect(this.gain);
            this.gain.connect(this.ctx.destination);
            return;
        }

        this.analyser.connect(this.preamp);

        const filters = [...this.filters.values()];

        let previous: AudioNode = this.preamp;

        filters.forEach(filter => {
            previous.connect(filter);
            previous = filter;
        });

        previous.connect(this.gain);

        this.gain.connect(this.ctx.destination);
    }

    // 🎵 Load stream URL (backend endpoint / GridFS / CDN)
    load(src: string) {
        this.audio.crossOrigin = "use-credentials"
        this.audio.src = src;
    }

    // Play
    async play() {
        if (this.ctx.state === "suspended") {
            await this.ctx.resume();
        }
        return this.audio.play();
    }

    // Pause
    pause() {
        this.audio.pause();
    }

    destroy() {
        this.audio.pause();
        this.audio.src = "";
        this.audio.load(); // resets element

        this.sourceNode.disconnect();
        this.analyser.disconnect();
        this.gain.disconnect();

        this.filters.forEach(filter => {
            filter.disconnect();
        });

        this.ctx.close();
    }

    async seek(time: number) {
        const audio = this.audio;

        return new Promise<void>((resolve) => {
            const onSeeked = () => {
                audio.removeEventListener("seeked", onSeeked);
                resolve();
            };

            audio.addEventListener("seeked", onSeeked);
            audio.currentTime = time;
        });
    }

    setVolume(value: number) {
        this.gain.gain.value = value; // 0 → 1
    }

    get currentTime() {
        return this.audio.currentTime;
    }

    get duration() {
        return this.audio.duration;
    }

    onTimeUpdate(cb: () => void) {
        this.audio.addEventListener("timeupdate", cb);

        return () => {
            this.audio.removeEventListener("timeupdate", cb);
        };
    }

    onLoaded(cb: () => void) {
        this.audio.addEventListener("loadedmetadata", cb);

        return () => {
            this.audio.removeEventListener("loadedmetadata", cb);
        };
    }

    onEnded(cb: () => void) {
        this.audio.addEventListener("ended", cb);

        return () => {
            this.audio.removeEventListener("ended", cb);
        };
    }

    // Audio analysis (waveform / FFT)
    getFrequencyData(): Uint8Array {
        const data = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(data);
        return data;
    }

    getTimeDomainData(): Uint8Array {
        const data = new Uint8Array(this.analyser.fftSize);
        this.analyser.getByteTimeDomainData(data);
        return data;
    }

    // Equalizer
    setEQBand(frequency: number, gain: number) {
        const filter = this.filters.get(frequency);

        if (!filter)
            return;

        filter.gain.value = gain;
    }

    setPreamp(value: number) {
        if (!this.preamp)
            return;

        this.preamp.gain.value = value;
    }

    resetEqualizer() {
        this.filters.forEach(filter => {
            filter.gain.value = 0;
        });

        if (this.preamp)
            this.preamp.gain.value = 1;
    }

    setEqualizerEnabled(enabled: boolean) {
        this.equalizerEnabled = enabled;

        this.rebuildAudioGraph();
    }
}