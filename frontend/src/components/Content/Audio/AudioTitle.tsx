import { useEffect, useState } from "react"
import { MicVocal } from "../../../assets/icons/MicVocal"
import { LibraryBig } from "../../../assets/icons/LibraryBig"
import { useNotification } from "../../../contexts/NotificationContext"
import { useAuth } from "../../../contexts/AuthContext"

export function AudioTitle({ audioId }: { audioId: string }) {
    const { jsonAuthFetch } = useAuth();

    const [data, setData] = useState<any>(undefined)

    const { notify } = useNotification()

    useEffect(() => {
        if (audioId)
            jsonAuthFetch(`/api/audio/info/?audioId=${audioId}`)
                .then(async (v) => {
                    if (v === false)
                        notify('failed to get audio info', 3000, 'error')
                    else {
                        setData(await v.json())
                    }
                })

    }, [audioId])

    return (
        <div className="size-full text-black flex flex-col gap-1 *:w-full">
            <div className="text-start text-lg text-on-surface">{data?.metadata?.title}</div>
            <div className="text-sm text-on-surface-variant flex flex-row items-center size-4">
                <MicVocal strokeWidth={1.2} className="size-4" />
                <div>{data?.metadata?.artists[0]}</div>
            </div>
            <div className="text-xs text-on-surface-variant flex flex-row items-center">
                <LibraryBig strokeWidth={1.2} className="size-4" />
                <div>{data?.metadata?.album}</div>
            </div>
        </div>
    )
}
