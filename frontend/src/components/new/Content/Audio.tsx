import ProgressBar from "../../ProgressBar";
import { Ripple } from "../../Ripple";

export function Audio({ audioId }: { audioId: string }) {
    return (
        <div>
            <div className="w-[80%] max-w-[10cm] aspect-square">
                <CoverArt audioId={audioId} onLoaded={prepareDominantColor} className='rounded-2xl shadow-2xl' coverArtRef={coverArtRef} />
            </div>

            {/* Separator */}
            <div className="grow" />

            <div className="flex flex-col text-center w-full">
                <AudioTitle audioId={audioIds[audio.index]} />
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
        </div>
    )
}
