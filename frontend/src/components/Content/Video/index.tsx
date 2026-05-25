import { useContext, useEffect, useRef, useState } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { Ripple } from "../../Ripple";
import { Slide } from "../../Slide";
import { Upload } from "../Upload";
import { LeafContext } from "../../LeafManager";
import { VideoPlayer } from "./VideoPlayer";
import Hls from "hls.js";
import { X } from "../../../assets/icons/X";
import { Button } from "../../Button";

export function Video({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const videoIds = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value

    const [openVideoUploadModal, setOpenVideoUploadModal] = useState(false)

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


    return (
        !videoIds || videoIds.length === 0
            ? 'No videos!'
            : <div className="size-full flex flex-col gap-4 p-2 border border-outline rounded-lg overflow-x-auto">
                {
                    editing &&
                    <div className="flex flex-row justify-between gap-1 p-2 *:p-2">
                        {/* Remove button */}
                        <Button isIcon variant="text" color="error" onPointerDown={() => leafContext.removeContents(contentIndex)}>
                            <Trash2 />
                        </Button>

                        {/* Add button */}
                        <Button isIcon variant="text" color="success" onPointerDown={async () => setOpenVideoUploadModal(true)}>
                            <Plus />
                        </Button>
                    </div>
                }

                <div className="w-full overflow-x-auto">
                    <div className="w-fit p-2 flex flex-row items-center gap-2">
                        {videoIds.map((m, i) => <VideoPlayer key={i} contentIndex={contentIndex} videoId={m} onSelect={(id) => setSelected(id)} />)}
                    </div>
                    <div className="flex flex-row items-center justify-center relative">
                        {
                            selected &&
                            <div className="absolute top-0 right-0">
                                <Button isIcon variant="text" color="on-surface" onPointerDown={async () => setSelected(undefined)}>
                                    <X />
                                </Button>
                            </div>
                        }

                        {/* Video player */}
                        {selected && <video ref={videoRef} controls autoPlay={true} className="w-[auto] h-96" crossOrigin="use-credentials" />}
                    </div>
                </div>

                <Slide open={openVideoUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-lg" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <Upload type='videoId' onClose={() => setOpenVideoUploadModal(false)} onUpload={async (ids) => {
                        leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value.push(...ids)

                        const result = await leafContext.updateLeaf(leaf)
                        if (result === false)
                            return

                        leafContext.onLeafChange(leaf);
                    }} />
                </Slide>
            </div>
    )
}
