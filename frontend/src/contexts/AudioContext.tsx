import { createContext, useEffect, useState } from "react";
import { Slide } from "../components/new/Slide";
import { AudioPlayer } from "../components/AudioPlayer";

export const AudioContext = createContext<{
    open: boolean,
    setOpen: (state: boolean) => void,
    audioIds: string[],
    setAudioIds: (audioIds: string[]) => void
}>({
    open: false,
    setOpen: () => { },
    audioIds: [],
    setAudioIds: () => { },
})

export function AudioContextProvider({ children }: { children: React.ReactNode }) {
    const [openAudioPlayer, setOpenAudioPlayer] = useState<boolean>(false)
    const [audioIds, setAudioIds] = useState<string[]>([])

    useEffect(() => {
        if (audioIds.length === 0) {
            const storedAudioIdsJson = window.localStorage.getItem('audioIds')
            if (storedAudioIdsJson !== null)
                setAudioIds(JSON.parse(storedAudioIdsJson))
        }
    }, [])

    useEffect(() => {
        window.localStorage.setItem('audioIds', JSON.stringify(audioIds))
    }, [audioIds])

    console.log('AudioContextProvider', { openAudioPlayer, audioIds });

    return (
        <AudioContext.Provider
            value={{
                open: openAudioPlayer,
                setOpen: (state: boolean) => setOpenAudioPlayer(state),
                audioIds,
                setAudioIds: (audioIds: string[]) => setAudioIds(audioIds),
            }}
        >
            {children}

            <div className="pointer-events-none absolute size-full top-0 left-0 overflow-hidden">
                <Slide open={openAudioPlayer} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <AudioPlayer onClose={() => setOpenAudioPlayer(false)} />
                </Slide>
            </div >

        </AudioContext.Provider >
    )
}

