import { useContext, useEffect, useState } from "react"
import { ChevronDown } from "../assets/icons/ChevronDown"
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import { Ripple } from "./Ripple";
import { jwtDecode } from "jwt-decode";
import { Pencil } from "../assets/icons/Pencil";
import { Slide } from "./new/Slide";
import { AvatarUpload } from "./AvatarUpload";
import { AudioContext } from "../contexts/AudioContext";

export function ArtistPresenter({ artistId, onClose }: { artistId?: string, onClose?: () => void }) {
    const { jsonAuthFetch, accessToken } = useAuth();
    const { notify } = useNotification()
    const { setOpen: setAudioPlayerOpen, setAudioIds } = useContext(AudioContext)

    const [src, setSrc] = useState<string | undefined>(undefined)
    const [bannerSrc, setBannerSrc] = useState<string | undefined>(undefined)
    const [artistData, setArtistData] = useState<any>()
    const [albums, setAlbums] = useState<any[]>([])
    const [openAvatarUpload, setOpenAvatarUpload] = useState(false)

    const [progress, setProgress] = useState(0)
    const [smallAvatarProgress, setSmallAvatarProgress] = useState(0)

    const handleAlbumClick = async (albumId: string) => {
        try {
            let r = await jsonAuthFetch(`/api/album/?albumId=${albumId}`)
            if (r === false || !r.ok)
                return notify('failed to fetch album data', 3000, 'error')

            let albumData = await r.json()
            let ids: string[] = []
            albumData.audios.forEach((a: any) => { ids.push(a.audioId) });

            onClose?.();
            setAudioIds(ids)
            setAudioPlayerOpen(true)
        } catch (err) {
            console.error(err)
            notify('failed to fetch', 3000, 'error')
        }
    }

    useEffect(() => {
        const run = async () => {
            try {
                if (!artistId)
                    return

                if (artistId) {
                    let r = await jsonAuthFetch(`/api/artist/avatar/?artistId=${artistId}&type=avatar`)
                    if (r !== false && r.ok) {
                        const b = await r.blob()
                        const imageUrl = URL.createObjectURL(b);

                        if (imageUrl)
                            setSrc(imageUrl)
                    }

                    let rr = await jsonAuthFetch(`/api/artist/avatar/?artistId=${artistId}&type=banner`)
                    if (rr !== false && rr.ok) {
                        const b = await rr.blob()
                        const imageUrl = URL.createObjectURL(b);

                        if (imageUrl)
                            setBannerSrc(imageUrl)
                    }
                }

                if (artistId) {
                    let r = await jsonAuthFetch(`/api/artist/?artistId=${artistId}`)
                    if (r !== false && r.ok) {
                        const ad = await r.json()
                        setArtistData(ad)
                    }

                    let rr = await jsonAuthFetch(`/api/album/?artistId=${artistId}`)
                    if (rr !== false && rr.ok) {
                        const albums = await rr.json()
                        setAlbums(albums)
                    }
                }
            } catch (err) {
                console.error(err)
                notify('failed to fetch', 3000, 'error')
            }
        }

        if (artistId)
            run()
    }, [artistId])

    let payload: any
    if (accessToken)
        payload = jwtDecode(accessToken);

    const admin = payload?.username === 'hirbod'

    console.log({ payload, artistData, openAvatarUpload });

    return (
        <div className="bg-surface size-full rounded-t-2xl overflow-auto relative" onScroll={(e) => {
            const y = e.currentTarget.scrollTop;
            const collapseDistance = 150;

            const p = Math.min(Math.max(y / collapseDistance, 0), 1);
            setProgress(p);

            const offset = 100
            const pp = Math.min(Math.max((y - offset) / (collapseDistance), 0), 1);
            setSmallAvatarProgress(pp);
        }}>

            {/* Banner */}
            <div className="absolute top-0 left-0 w-full h-[3cm]" style={{ opacity: 1 - progress }}>
                <img src={bannerSrc || "/default_cover_art.png"} alt="Avatar" className="object-center object-cover size-full" />
            </div>

            <div className="absolute top-0 left-0 p-3 flex flex-row items-center w-full">
                <div className="grow" />

                <div className="text-on-surface" onClick={onClose}>
                    <ChevronDown />
                </div>
            </div>

            <div className="h-[2.5cm]"></div>

            {/* Big avatar */}
            <div className="p-1 h-[5cm] w-full flex flex-col items-start relative transition-opacity duration-0" style={{ opacity: 1 - progress }}>
                <div className="flex flex-col items-start">
                    <div className="size-[2.5cm] rounded-full relative border-2">
                        <img src={src || "/default_avatar.jpg"} alt="Avatar" className="rounded-full object-center object-cover size-full" />
                        {
                            admin &&
                            <div className="absolute bottom-0 -right-5 p-1 m-2 text-on-primary bg-primary rounded-full" onClick={() => setOpenAvatarUpload(true)}>
                                <Pencil className="size-4" />
                            </div>
                        }
                    </div>

                    <div className="p-3 w-full text-xs text-start text-on-surface">
                        {artistData?.name}
                    </div>
                </div>
            </div>

            {artistId && artistData?.name &&
                <div className="pointer-events-none absolute z-50 w-full top-0 left-0 overflow-hidden">
                    <Slide open={openAvatarUpload} className="pointer-events-auto rounded-3xl bg-surface-variant shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <AvatarUpload artistId={artistId} artistName={artistData.name} onClose={() => setOpenAvatarUpload(false)} />
                    </Slide>
                </div >
            }

            <div className="relative">
                {/* small avatar */}
                <div
                    className={`sticky top-[20px] left-0 mt-[20px] backdrop-blur-md z-10 transition-all duration-0 flex flex-row items-center justify-center ${smallAvatarProgress === 1 ? 'border-b border-outline' : ''}`}
                    style={{ opacity: smallAvatarProgress, transform: `translateY(${smallAvatarProgress * -20}px)` }}
                >
                    <div className="size-8 rounded-full overflow-hidden">
                        <img src={src || "/default_avatar.jpg"} alt="No Artist" />
                    </div>

                    <div className="p-3 text-xs text-on-surface">
                        {artistData?.name}
                    </div>
                </div>

                <div className="p-3 flex flex-row flex-wrap gap-2">
                    {albums.map((a: any, i: number) =>
                        <Ripple key={i}>
                            <div className="flex flex-col items-center gap-1 w-[3cm]" onClick={() => handleAlbumClick(a._id)}>
                                <div className="size-[3cm]">
                                    <img src={`/api/album/avatar/?albumId=${a._id}`} alt="Album cover art" crossOrigin="use-credentials" />
                                </div>

                                <div className="text-on-surface text-center">
                                    {a.name}
                                </div>
                            </div>
                        </Ripple>
                    )}
                </div>

                <div className="h-[30cm]" />
            </div>
        </div>
    )
}
