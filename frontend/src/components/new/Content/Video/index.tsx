import { useEffect, useRef, useState } from "react"
import Hls from 'hls.js'

// { type, values, onRemove, onRemoveAll }: { type: Types, values: string[], onRemove?: (v: string) => void, onRemoveAll?: () => void }
export function Video({ videoIds, editing, onLeafChange, onRemove, onRemoveAll }: { videoIds: string[], editing: boolean, onLeafChange?: (videoIds: string[]) => void, onRemove?: (v: string) => void, onRemoveAll?: () => void }) {
    const [selected, setSelected] = useState<string | undefined>(undefined)

    const videoRef = useRef<HTMLVideoElement>(null)

    useEffect(() => {
        if (!videoRef.current || !selected)
            return

        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            videoRef.current.src = selected
            return
        }

        if (Hls.isSupported()) {
            const hls = new Hls()

            hls.loadSource(`/api/video/file/${selected}/index.m3u8`)
            hls.attachMedia(videoRef.current)

            return () => {
                hls.destroy()
            }
        }
    }, [selected])

    return (
        !videoIds || videoIds.length === 0
            ? 'No images!'
            : <div className="size-full flex flex-col gap-4 p-2 border overflow-x-auto">
                <div className="size-auto p-2 flex flex-row items-center border">
                    {
                        videoIds.map((m, i) =>
                            <img key={i} src={`/api/video/thumbnail/${m}`} crossOrigin="use-credentials" onClick={() => setSelected(m)} className="w-[100vw] border" />
                        )
                    }
                </div>
                {
                    selected &&
                    <video ref={videoRef} controls autoPlay={false} className="w-[100vw]" crossOrigin="use-credentials" />
                }
            </div>
    )
}
