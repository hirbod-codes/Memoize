import { useContext, useEffect, useRef, useState } from "react"
import { useAuth } from "../../../contexts/AuthContext"
import { useNotification } from "../../../contexts/NotificationContext"
import { LeafContext } from "../../LeafManager"
import { Ripple } from "../../Ripple"
import { SquareMinus } from "../../../assets/icons/SquareMinus"
import Hls from "hls.js"
import { X } from "../../../assets/icons/X"

export function VideoPlayer({ videoId, contentIndex }: { videoId: string, contentIndex: number }) {
    if (!videoId)
        return null

    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const editing = leafContext.editing

    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [video, setVideo] = useState<any>()
    const [selected, setSelected] = useState<string | undefined>(undefined)
    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (!videoRef.current || !selected)
            return

        const src = `/api/video/file/${selected}/index.m3u8`

        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = src
            return
        }

        if (Hls.isSupported()) {
            const hls = new Hls()

            hls.loadSource(src)
            hls.attachMedia(videoRef.current)

            hls.on(Hls.Events.ERROR, (_, data) => {
                console.error('[HLS]: ', data)
            })
            return () => {
                hls.destroy()
            }
        }
    }, [selected])

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
        <div className="w-[4cm] rounded-lg border border-outline relative flex flex-col gap-2">
            {/* Remove button */}
            {
                editing &&
                <div className="absolute top-0 right-0">
                    <Ripple className="rounded-full bg-error text-on-error p-1">
                        <button onClick={async () => leafContext.removeContent(contentIndex, videoId)}>
                            <SquareMinus className="size-4" />
                        </button>
                    </Ripple>
                </div>
            }

            <img src={`/api/video/thumbnail/${videoId}`} crossOrigin="use-credentials" onClick={() => setSelected(videoId)} className="w-[4cm] min-h-32 border" />

            {/* Title */}
            {video &&
                <div className="text-lg border border-outline rounded-lg">
                    {video.title}
                </div>
            }

            {/* Video player */}
            {
                selected &&
                <div className="w-full h-96 relative">
                    <div className="absolute top-0 right-0">
                        <Ripple className="rounded-full bg-surface text-on-surface">
                            <button onClick={async () => setSelected(undefined)}>
                                <X />
                            </button>
                        </Ripple>
                    </div>
                    <video ref={videoRef} controls autoPlay={true} className="w-[auto] h-96" crossOrigin="use-credentials" />
                </div>
            }
        </div>
    )
}
