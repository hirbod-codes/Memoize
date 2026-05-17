import { createContext, useState } from "react";
import { Slide } from "../components/new/Slide";
import { ArtistPresenter } from "../components/ArtistPresenter";

export const ArtistContext = createContext<{
    open: boolean,
    setOpen: (state: boolean) => void,
    artistId: string,
    setArtistId: (artistId: string) => void
}>({
    open: false,
    setOpen: () => { },
    artistId: '',
    setArtistId: () => { },
})

export function ArtistContextProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState<boolean>(false)
    const [artistId, setArtistId] = useState<string>('')

    console.log('ArtistContextProvider', { open, artistId });

    return (
        <ArtistContext.Provider
            value={{
                open,
                setOpen,
                artistId,
                setArtistId: (artistId: string) => setArtistId(artistId),
            }}
        >
            {children}

            <div className="pointer-events-none absolute size-full top-0 left-0 overflow-hidden">
                <Slide open={open} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <ArtistPresenter artistId={artistId} onClose={() => setOpen(false)} />
                </Slide>
            </div >

        </ArtistContext.Provider >
    )
}

