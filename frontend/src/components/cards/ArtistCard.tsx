import { useEffect, useState } from "react";
import { Ripple } from "../Ripple";
import { useAuth } from "../../contexts/AuthContext";

export function ArtistCard({ name, artistId, clicked }: { name?: string, artistId?: string, clicked?: () => void }) {
    const { jsonAuthFetch } = useAuth();

    const [_error, setError] = useState(false)
    const [src, setSrc] = useState<string | undefined>(undefined)
    const [content, setContent] = useState('')

    useEffect(() => {
        const run = async () => {
            try {
                if (!name && !artistId)
                    return

                let content: string = ''
                if (artistId) {
                    let r = await jsonAuthFetch(`/api/artist/?artistId=${artistId}`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch')

                    const json = await r.json()
                    content = json.name
                } else if (name) {
                    let r = await jsonAuthFetch(`/api/artist/?name=${name}`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch')

                    const json = await r.json()
                    content = json.name
                }

                setContent(content)

                if (artistId) {
                    let r = await jsonAuthFetch(`/api/artist/avatar/?artistId=${artistId}&type=avatar`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch')

                    const b = await r.blob()
                    const imageUrl = URL.createObjectURL(b);

                    if (imageUrl) {
                        setSrc(imageUrl)
                        setError(false)
                    }
                } else if (name) {
                    let r = await jsonAuthFetch(`/api/artist/avatar/?name=${name}`)
                    if (r === false || !r.ok)
                        throw new Error('failed to fetch')

                    const b = await r.blob()
                    const imageUrl = URL.createObjectURL(b);

                    if (imageUrl) {
                        setSrc(imageUrl)
                        setError(false)
                    }
                }
            } catch (err) {
                console.error(err)
                setError(true)
            }
        }

        run()
    }, [name]);

    return (
        <>
            <Ripple className="p-2 items-stretch">
                <div className="flex flex-row items-center gap-2" onClick={() => { clicked?.() }}>
                    <div className="size-10">
                        <img src={src || '/default_avatar.jpg'} alt="Avatar" className="object-center object-cover rounded-full shadow-inner" onError={() => setError(true)} />
                    </div>

                    <div className="text-on-surface">
                        {content}
                    </div>
                </div>
            </Ripple>
        </>
    )
}
