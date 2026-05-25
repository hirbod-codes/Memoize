import { useContext, useEffect, useState } from "react"
import { useAuth } from "../../../contexts/AuthContext"
import { useNotification } from "../../../contexts/NotificationContext"
import { LeafContext } from "../../LeafManager"
import { SquareMinus } from "../../../assets/icons/SquareMinus"
import { Button } from "../../Button"

export function VideoPlayer({ videoId, contentIndex, onSelect }: { videoId: string, contentIndex: number, onSelect: (id: string) => void }) {
    if (!videoId)
        return null

    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const editing = leafContext.editing

    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [video, setVideo] = useState<any>()

    const getVideoInfo = async () => {
        try {
            const r = await jsonAuthFetch(`/api/video/info?videoId=${videoId}`)
            if (r === false || !r.ok) {
                notify('failed to get video info', 3000, 'error')
                return false
            }

            const data = await r.json()

            return data
        } catch (e) {
            console.error(e);
            notify('failed to get video info', 3000, 'error')
            return false
        }
    }

    useEffect(() => {
        getVideoInfo()
            .then(v => {
                if (v === false)
                    return

                setVideo(v)
            })
    }, [videoId])

    return (
        <div className="w-[4cm] rounded-lg border border-outline relative flex flex-col gap-2 overflow-hidden p-2">
            {/* Remove button */}
            {
                editing &&
                <div className="absolute top-0 right-0">
                    <Button isIcon variant="text" color="error" onPointerDown={async () => leafContext.removeContent(contentIndex, videoId)}>
                        <SquareMinus className="size-4" />
                    </Button>
                </div>
            }

            <img src={`/api/video/thumbnail/${videoId}`} crossOrigin="use-credentials" onPointerDown={() => onSelect(videoId)} className="w-full object-contain rounded-lg" />

            {/* Title */}
            {video &&
                <div className="text-lg border border-outline rounded-lg p-2 text-wrap w-full overflow-hidden">
                    {video.title}
                </div>
            }
        </div>
    )
}
