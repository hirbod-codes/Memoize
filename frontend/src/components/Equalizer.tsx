import { useRef, useState } from "react";
import type { AudioManager } from "../audio/AudioManager";
import { EQ_PRESETS, FREQUENCIES } from "../audio/EQPresets";
import { Ripple } from "./Ripple";
import { Select } from "./Select";
import ProgressBar from "./ProgressBar";

export function Equalizer({ audioManager }: { audioManager: AudioManager }) {
    const [enabled, setEnabled] = useState(audioManager.state.equalizer.enabled);
    const [bands, setBands] = useState(audioManager.state.equalizer.bands);
    const isSeekingFrqBandRef = useRef<boolean>(false);

    const updateBand = (freq: keyof typeof bands, value: number) => {
        const gain = Number(value);

        setBands(prev => ({
            ...prev,
            [freq]: gain,
        }));

        audioManager.setEQBand(freq, gain);
    };

    const toggle = () => {
        setEnabled(!enabled);
        audioManager.setEqualizerEnabled(!enabled);
    };

    const applyPreset = (name: keyof typeof EQ_PRESETS) => {
        const preset = EQ_PRESETS[name];

        for (const k of Object.keys(preset)) {
            const key: keyof typeof bands = k.toString() as any;

            updateBand(key, preset[key])
        }
    };

    return (
        <div className="flex flex-col gap-2 text-on-surface">
            <div className="p-2">Equalizer</div>

            <Ripple className="bg-surface rounded-xl p-2">
                <button onClick={toggle}>
                    {enabled ? "Enabled" : "Disabled"}
                </button>
            </Ripple>

            <Ripple className="p-0">
                <Select
                    onChange={(e) => {
                        applyPreset(e.target.value as any)
                    }}
                    containerProps={{
                        className: 'p-2 flex flex-row justify-between items-center gap-2 bg-surface rounded-xl'
                    }}
                    selectProps={{
                        className: 'bg-surface-variant text-on-surface-variant rounded-xl p-1'
                    }}
                >
                    {Object.keys(EQ_PRESETS).map(p => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </Select>
            </Ripple>

            <div className="bg-surface rounded-xl flex flex-col gap-2 p-2 justify-center">
                {FREQUENCIES.map(freq => (
                    <div key={freq} className="flex flex-row gap-1 items-center">
                        <div className="text-xs text-on-surface overflow-hidden w-[1.7cm]">{freq}Hz</div>
                        <div className="text-xs text-on-surface overflow-hidden w-[0.8cm]">
                            {bands[freq].toFixed(1)}
                        </div>

                        <div className="h-full grow ">
                            <ProgressBar
                                progress={((bands[freq] + 12) / 24) * 100}
                                transitionRef={isSeekingFrqBandRef}
                                onPointerDown={(e) => { e.preventDefault(); isSeekingFrqBandRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
                                onPointerMove={(e) => {
                                    e.preventDefault()

                                    if (!isSeekingFrqBandRef.current)
                                        return

                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const fraction = ((e.clientX - rect.left) / rect.width);
                                    const value = (fraction * 24) - 12

                                    updateBand(freq as any, value)
                                }}
                                onPointerUp={async (e) => {
                                    e.currentTarget.releasePointerCapture(e.pointerId);

                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const fraction = ((e.clientX - rect.left) / rect.width);
                                    const value = (fraction * 24) - 12

                                    isSeekingFrqBandRef.current = false;

                                    updateBand(freq as any, value)
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}