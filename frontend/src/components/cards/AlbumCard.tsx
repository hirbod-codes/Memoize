import { useContext, useEffect, useState } from "react";
import { Ripple } from "../Ripple";
import { useAuth } from "../../contexts/AuthContext";
import { Play } from "../../assets/icons/Play";
import { useNotification } from "../../contexts/NotificationContext";
import { AudioContext } from "../../contexts/AudioContext";

export function AlbumCard({ name }: { name: string }) {
    const { jsonAuthFetch } = useAuth();

    const [_error, setError] = useState(false)
    const [src, setSrc] = useState<string | undefined>(undefined)
    const [avatarLoaded, setAvatarLoaded] = useState(false)
    const [audioIdsState, setAudioIdsState] = useState<string[]>([])

    const { setOpen, setAudioIds } = useContext(AudioContext)
    const { notify } = useNotification()

    // console.log({ openAudioPlayer, setAudioNames, avatarLoaded, audioNamesState });

    useEffect(() => {
        const run = async () => {
            try {
                if (!name)
                    return

                let r = await jsonAuthFetch(`/api/album/?name=${name}`)
                if (r === false || !r.ok)
                    throw new Error('failed to fetch')

                let albumData
                try { albumData = await r.json() }
                catch (err) {
                    console.error('json', 'failed to parse data', err)
                    notify('failed to parse data', 3000, 'error')
                    setError(true)
                    return
                }
                console.log({ albumData })

                const ids: string[] = [];
                (albumData.audios as { trackNumber: number, title: string, audioId: string }[]).forEach(f => { ids[f.trackNumber] = f.audioId; });
                setAudioIdsState(ids)
                console.log('run', { ids })

                r = await jsonAuthFetch(`/api/album/avatar/?name=${name}`)
                if (r === false || !r.ok)
                    throw new Error('failed to fetch')
                try {
                    const b = await r.blob()
                    const imageUrl = URL.createObjectURL(b);

                    if (imageUrl) {
                        setSrc(imageUrl)
                        setError(false)
                    }
                } catch (err) {
                    console.error('blob', err)
                    notify('failed to load image', 3000, 'error')
                    setError(true)
                    return
                }
            } catch (err) {
                console.error(err)
                notify('failed to fetch', 3000, 'error')
                setError(true)
            }
        }

        run()
    }, [name]);

    return (
        <Ripple className="p-2 items-stretch">
            <div className="flex flex-row items-center justify-start gap-2">
                <div className="w-[1cm] relative">
                    {
                        !avatarLoaded &&
                        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 size-full bg-surface flex flex-col items-center justify-center">
                            <div className="size-full border-2 border-on-surface border-t-primary rounded-full animate-spin" />
                        </div>
                    }
                    <img src={src || '/default_avatar.jpg'} alt="Avatar" className="object-cover shadow-inner" onLoad={() => setAvatarLoaded(true)} onError={() => setError(true)} />
                </div>

                <div className="text-on-surface w-min grow">
                    {name}
                </div>

                <Ripple className="shadow-2xl rounded-full">
                    <button onClick={() => { setAudioIds(audioIdsState); setOpen(true) }}>
                        <Play />
                    </button>
                </Ripple>
            </div>
        </Ripple>
    )
}
