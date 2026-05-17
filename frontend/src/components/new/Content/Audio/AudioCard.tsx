import { useEffect, useState } from "react";
import { Ripple } from "../Ripple";
import { useAuth } from "../../contexts/AuthContext";

export function AudioCard({ title, audioId, clicked, children }: { title?: string, audioId?: string, clicked?: () => void, children?: React.ReactNode }) {
    const { jsonAuthFetch } = useAuth();

    const [_error, setError] = useState(false)
    const [src, setSrc] = useState<string | undefined>(undefined)
    const [content, setContent] = useState('')

    useEffect(() => {
        const run = async () => {
            try {
                if (!title && !audioId)
                    return

                let id
                if (!audioId) {
                    let r = await jsonAuthFetch(`/api/audio/info/?title=${title}`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch audio info')

                    const audio = await r.json()
                    if (!audio._id)
                        throw new Error('failed to fetch audio info')

                    id = audio._id
                } else
                    id = audioId

                if (!title) {
                    let r = await jsonAuthFetch(`/api/audio/info/?audioId=${audioId}`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch audio info')

                    const audio = await r.json()
                    if (!audio._id)
                        throw new Error('failed to fetch audio info')

                    title = audio.title
                }

                setContent(title ?? '')

                let r = await jsonAuthFetch(`/api/audio/coverArt/${id}`)
                if (r === false || !r.ok)
                    throw new Error('failed to fetch audio cover art')

                const b = await r.blob()
                const imageUrl = URL.createObjectURL(b);

                if (imageUrl) {
                    setSrc(imageUrl)
                    setError(false)
                }
            } catch (err) {
                console.error(err)
                setError(true)
            }
        }

        run()
    }, [title]);

    return (
        <Ripple className="p-2 items-stretch">
            <div className="flex flex-row justify-start items-center gap-2">
                <div className="grow flex flex-row justify-start items-center gap-2" onClick={() => { clicked?.() }}>
                    <div className="w-[1cm]">
                        <img src={src || '/default_avatar.jpg'} alt="Avatar" className="object-cover shadow-inner size-full" onError={() => setError(true)} />
                    </div>

                    <div className="text-on-surface w-min text-wrap grow">
                        {content}
                    </div>
                </div>

                {children}
            </div>
        </Ripple>
    )
}
