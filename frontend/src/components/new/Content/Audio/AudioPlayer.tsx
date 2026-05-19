import { motion } from "framer-motion";
import { Pause } from "../../../../assets/icons/Pause";
import { Play } from "../../../../assets/icons/Play";
import { useContext, useEffect, useRef, useState } from "react";
import { CoverArt } from "./CoverArt";
import { AudioTitle } from "./AudioTitle";
import { Forward } from "../../../../assets/icons/Forward";
import { Backward } from "../../../../assets/icons/Backward";
import { VolumeX } from "../../../../assets/icons/VolumeX";
import { Volume1 } from "../../../../assets/icons/Volume1";
import { Volume2 } from "../../../../assets/icons/Volume2";
import { Repeat } from "../../../../assets/icons/Repeat";
import { Repeat1 } from "../../../../assets/icons/Repeat1";
import { AdjustmentsHorizontal } from "../../../../assets/icons/AdjustmentsHorizontal";
import { ThemeContext } from "../../../../contexts/ThemeOptionsContext";
import { Vibrant } from "node-vibrant/browser";
import { useAudio } from "../../../../audio/useAudio";
import { Ripple } from "../../../Ripple";
import { ChevronUp } from "../../../../assets/icons/ChevronUp";
import { ReceiptText } from "../../../../assets/icons/ReceiptText";
import { useAuth } from "../../../../contexts/AuthContext";
import { useNotification } from "../../../../contexts/NotificationContext";
import { Ellipsis } from "../../../../assets/icons/Ellipsis";
import { audioManager } from "../../../../audio/AudioManager";
import ProgressBar from "./ProgressBar";
import { Equalizer } from "./Equalizer";

export function AudioPlayer({ audioId }: { audioId: string }) {
    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [showDetails, setShowDetails] = useState<boolean>(false)
    const [showEQ, setShowEQ] = useState(false)
    const [showPlaylist, setShowPlaylist] = useState(false)
    const [showLyrics, setShowLyrics] = useState(false)

    const [audioInfo, setAudioInfo] = useState<any | undefined>(undefined)

    // The dominant color
    const mode = useContext(ThemeContext)?.mode ?? 'dark'
    const bgRef = useRef<HTMLDivElement>(null)
    const coverArtRef = useRef<HTMLImageElement>(null)
    const [dominantColor, setDominantColor] = useState<string | undefined>(undefined)

    const prepareDominantColor = () => {
        if (!coverArtRef.current || !bgRef.current) {
            console.log('return!')
            return
        }

        if (coverArtRef.current && bgRef.current) {
            const run = async () => {
                try {
                    const palette = await Vibrant.from(coverArtRef.current).getPalette()
                    const to = mode === 'dark' ? (palette.DarkVibrant?.hex ?? '#ffffff') : (palette.LightVibrant?.hex ?? '#000000')
                    setDominantColor(to)
                } catch (err) {
                    console.warn(err)
                }
            }

            if (coverArtRef.current.complete)
                coverArtRef.current.onload = run
        }
    }

    // The player
    const audio = useAudio();

    const [audioState, setAudioState] = useState(audio.state)
    const [current, setCurrent] = useState(0);
    const isSeekingVolumeRef = useRef<boolean>(false);
    const isSeekingProgressRef = useRef<boolean>(false);

    useEffect(() => {
        if (audioId.length !== 0)
            audio.setPlaylist([audioId]);
    }, [audioId]);

    useEffect(() => {
        if (!isSeekingProgressRef.current)
            setCurrent(audio.state.current)
    }, [audio.state.current]);

    useEffect(() => {
        return audio.subscribe(() => {
            setAudioState(audio.state)
        })
    }, [])

    useEffect(() => {
        const run = async () => {
            const r = await jsonAuthFetch(`/api/audio/info?audioId=${audioState.audioId}`)
            if (r === false || !r.ok) {
                notify('failed to fetch lyrics', 3000, 'error')
                setShowLyrics(false)
                return
            }

            try {
                const info = await r.json()
                console.log({ info })
                setAudioInfo(info)
            }
            catch (err) {
                console.error(err);
                notify('failed to fetch lyrics', 3000, 'error')
            }
        }

        run()
    }, [audioState.audioId])

    function formatTime(sec: number) {
        if (!sec) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    }

    const animateUp = showPlaylist || showLyrics || showEQ || showDetails
    const animateDown = () => {
        setShowPlaylist(false)
        setShowLyrics(false)
        setShowEQ(false)
        setShowDetails(false)
    }

    return (
        <div className="size-full rounded-t-2xl *:p-3 overflow-hidden relative" ref={bgRef} style={{ background: `linear-gradient(to bottom, ${dominantColor}, ${mode === 'dark' ? '#000000' : '#ffffff'})` }}>
            <motion.div
                initial={{ y: "0vh" }}
                animate={{ y: animateUp ? "-100vh" : "0vh" }}
                exit={{ y: "0vh" }}
                transition={{
                    duration: 0.7,
                    ease: [0, 1, 0.5, 1],
                }}
                className={'flex flex-col gap-1 size-full items-center absolute'}
            >
                <div className="w-[80%] max-w-[10cm] aspect-square">
                    <CoverArt audioId={audioId[audio.index]} onLoaded={prepareDominantColor} className='rounded-2xl shadow-2xl' coverArtRef={coverArtRef} />
                </div>

                {/* Separator */}
                <div className="grow" />

                <div className="flex flex-col text-center w-full">
                    <AudioTitle audioId={audioId[audio.index]} />
                </div>

                {/* Separator */}
                <div className="p-4" />

                {/* Progress */}
                <div className="relative w-full h-8 flex flex-col gap-1 justify-center">
                    <ProgressBar
                        progress={audio.state.duration !== 0 ? ((current / audio.state.duration) * 100) : 0}
                        dominantColor={dominantColor}
                        transitionRef={isSeekingProgressRef}
                        onPointerDown={(e) => { e.preventDefault(); isSeekingProgressRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
                        onPointerMove={(e) => {
                            e.preventDefault()

                            if (!isSeekingProgressRef.current)
                                return

                            const rect = e.currentTarget.getBoundingClientRect();
                            const fraction = ((e.clientX - rect.left) / rect.width);
                            const value = fraction * audio.state.duration

                            setCurrent(value);
                        }}
                        onPointerUp={async (e) => {
                            e.currentTarget.releasePointerCapture(e.pointerId);

                            const rect = e.currentTarget.getBoundingClientRect();
                            const fraction = ((e.clientX - rect.left) / rect.width);
                            const value = fraction * audio.state.duration

                            isSeekingProgressRef.current = false;

                            await audio.seek(value);
                            setCurrent(value);
                        }}
                    />

                    <div className="flex flex-row justify-between w-full">
                        <div className="opacity-70 text-xs text-on-surface">
                            {formatTime(audio.state.current)}
                        </div>
                        <div className="opacity-70 text-xs text-on-surface">
                            {formatTime(audio.state.duration)}
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="p-2" />

                {/* Audio Actions */}
                <div className="flex flex-row w-full items-center justify-around">
                    <Ripple className="rounded-full">
                        <button onClick={() => { audio.previous() }}>
                            <Backward strokeWidth={1} className="text-on-surface size-12" />
                        </button>
                    </Ripple>
                    {
                        audio.state.loaded
                            ? <Ripple className="rounded-full">
                                <button className="cursor-pointer" onClick={() => audio.toggle()}>
                                    {audio.state.isPlaying ? (
                                        <Pause strokeWidth={1.2} className="text-on-surface size-12" />
                                    ) : (
                                        <Play strokeWidth={1.2} className="text-on-surface size-12" />
                                    )}
                                </button>
                            </Ripple>
                            : <div>
                                <div className="grow flex items-center justify-center">
                                    <div className="size-10 border-4 border-on-surface border-t-primary rounded-full animate-spin" />
                                </div>
                            </div>
                    }
                    <Ripple className="rounded-full">
                        <button onClick={() => { audio.next() }}>
                            <Forward strokeWidth={1} className="text-on-surface size-12" />
                        </button>
                    </Ripple>
                </div>

                {/* Separator */}
                <div className="p-2" />

                {/* Volume */}
                <div className="select-none touch-none flex flex-row gap-1 w-full items-center justify-around">
                    {audio.state.volume === 0
                        ? <VolumeX className="text-on-surface" />
                        : (
                            audio.state.volume < 0.5
                                ? <Volume1 className="text-on-surface" />
                                : <Volume2 className="text-on-surface" />
                        )
                    }
                    <div
                        className="w-full h-0.5 bg-on-surface rounded-sm cursor-pointer relative"
                        onPointerDown={(e) => { e.preventDefault(); isSeekingVolumeRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
                        onPointerMove={(e) => {
                            e.preventDefault();

                            if (!isSeekingVolumeRef.current)
                                return

                            const rect = e.currentTarget.getBoundingClientRect();
                            const fraction = ((e.clientX - rect.left) / rect.width);

                            audio.setVolume(Math.max(0, Math.min(1, fraction)))
                        }}
                        onPointerUp={async (e) => {
                            e.currentTarget.releasePointerCapture(e.pointerId);

                            const rect = e.currentTarget.getBoundingClientRect();
                            const fraction = ((e.clientX - rect.left) / rect.width);

                            audio.setVolume(Math.max(0, Math.min(1, fraction)));

                            isSeekingVolumeRef.current = false
                        }}
                        style={{ boxShadow: 'inset 0 0 5px -1px #000' }}
                    >
                        {/* filled */}
                        <div
                            className="h-full rounded-sm duration-300"
                            style={{
                                width: `${audio.state.volume * 100}%`,
                                background: dominantColor,
                                transition: isSeekingVolumeRef.current ? 'none' : 'width 0.3s ease, left 0.3s ease'
                            }}
                        />

                        {/* thumb */}
                        <div
                            className="absolute border top-1/2 -translate-y-1/2 size-3 bg-on-surface-variant rounded-full duration-300"
                            style={{
                                left: `calc(max(0px, ${audio.state.volume * 100}% - 12px))`,
                                transition: isSeekingVolumeRef.current ? 'none' : 'width 0.3s ease, left 0.3s ease',
                                boxShadow: '0 0 5px -1px #000',
                            }}
                        />
                    </div>
                </div>

                <div className="p-2" />

                {/* Actions */}
                <div className="flex flex-row w-full items-center justify-around">
                    {audio.state.repeat === 'no-repeat' &&
                        <Ripple>
                            <button className="cursor-pointer" onClick={() => audio.setRepeat('repeat')}>
                                <Repeat className="size-5 text-disabled" />
                            </button>
                        </Ripple>
                    }
                    {audio.state.repeat === 'repeat' &&
                        <Ripple>
                            <button className="cursor-pointer" onClick={() => audio.setRepeat('self-repeat')}>
                                <Repeat className="text-on-surface size-5" />
                            </button>
                        </Ripple>
                    }
                    {audio.state.repeat === 'self-repeat' &&
                        <Ripple>
                            <button className="cursor-pointer" onClick={() => audio.setRepeat('no-repeat')}>
                                <Repeat1 className="text-on-surface size-5" />
                            </button>
                        </Ripple>
                    }

                    <Ripple>
                        <button className="cursor-pointer" onClick={() => setShowLyrics(true)}>
                            <ReceiptText strokeWidth={1} className="text-on-surface size-5" />
                        </button>
                    </Ripple>

                    <Ripple>
                        <button className={`cursor-pointer`} onClick={() => setShowEQ(true)}>
                            <AdjustmentsHorizontal strokeWidth={1} className={`${audioManager.state.equalizer.enabled ? 'text-success' : 'text-on-surface'} size-5`} />
                        </button>
                    </Ripple>

                    <Ripple>
                        <button className="cursor-pointer" onClick={() => setShowDetails(true)}>
                            <Ellipsis strokeWidth={1} className="text-on-surface size-5" />
                        </button>
                    </Ripple>
                </div>
            </motion.div>

            <motion.div
                initial={{ y: "100vh" }}
                animate={{ y: animateUp ? "0vh" : "100vh" }}
                exit={{ y: "100vh" }}
                transition={{
                    duration: 0.7,
                    ease: [0, 1, 0.5, 1],
                }}
                className={'flex flex-col gap-1 size-full justify-start items-center absolute'}
            >
                <Ripple className="h-[1cm]">
                    <button className="cursor-pointer" onClick={() => { animateDown() }}>
                        <ChevronUp strokeWidth={1.5} className="text-on-surface size-8" />
                    </button>
                </Ripple>

                <div className="grow overflow-auto w-full">
                    {
                        showLyrics && audioInfo &&
                        <div className="text-on-surface text-center p-2">
                            {audioInfo?.metadata?.lyrics[0].text.split('\n').map((v: any, i: number) =>
                                <p key={i}>{v}</p>
                            )}
                        </div>
                    }

                    {
                        showEQ &&
                        <Equalizer
                            audioManager={audioManager}
                        />
                    }

                    {
                        showDetails && audioInfo &&
                        <div className="flex flex-col gap-3 text-on-surface *:rounded-xl *:bg-surface *:p-2">
                            {Object.keys(audioInfo).map((k: any, i: number) => {
                                if (k === '_id')
                                    return
                                if (typeof audioInfo[k] === 'object')
                                    return (
                                        <div key={i}>
                                            {k}

                                            <div className="border-b border-outline" />

                                            <div className="flex flex-col gap-1 p-4">
                                                {
                                                    Object.keys(audioInfo[k]).map((kk: any, ii: number) => {
                                                        if (typeof audioInfo[k][kk] === 'string' || typeof audioInfo[k][kk] === 'number' || typeof audioInfo[k][kk] === 'boolean')
                                                            return (
                                                                <div className="" key={ii} >
                                                                    <div className="w-full flex flex-row items-center justify-between">
                                                                        <div>
                                                                            {kk}:
                                                                        </div>
                                                                        <div className="max-w-[50%]">
                                                                            {
                                                                                typeof audioInfo[k][kk] === 'number'
                                                                                    ? audioInfo[k][kk].toFixed(2)
                                                                                    : audioInfo[k][kk].toString()
                                                                            }
                                                                        </div>
                                                                    </div>

                                                                    <div className="border-b border-outline my-2 mx-8" />
                                                                </div>
                                                            );
                                                    }
                                                    )
                                                }
                                            </div>
                                        </div>
                                    )
                                else if (typeof audioInfo[k] === 'string' || typeof audioInfo[k] === 'number' || typeof audioInfo[k] === 'boolean')
                                    return (
                                        <div className="flex flex-row items-center justify-between" key={i}>
                                            <div>
                                                {k}
                                            </div>
                                            <div>
                                                {audioInfo[k].toString()}
                                            </div>
                                        </div>
                                    )
                            })}
                        </div>
                    }
                </div>
            </motion.div>
        </div>
    )
}
