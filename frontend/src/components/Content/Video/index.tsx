import { useContext, useEffect, useRef, useState } from "react";
import Hls from 'hls.js';
import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { Ripple } from "../../Ripple";
import { Slide } from "../../Slide";
import { Upload } from "../Upload";
import { LeafContext } from "../../LeafManager";

export function Video({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const videoIds = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value

    const [selected, setSelected] = useState<string | undefined>(undefined)
    const [openVideoUploadModal, setOpenVideoUploadModal] = useState(false)

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
            ? 'No videos!'
            : <div className="size-full flex flex-col gap-4 p-2 border overflow-x-auto">
                {
                    editing &&
                    <div className="absolute top-0 right-0 flex flex-row gap-1 p-1">
                        {/* Add button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={async () => setOpenVideoUploadModal(true)}>
                                <Plus />
                            </button>
                        </Ripple>

                        {/* Remove button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={() => leafContext.removeContents(contentIndex)}>
                                <Trash2 />
                            </button>
                        </Ripple>
                    </div>
                }

                <div className="size-auto p-2 flex flex-row items-center border">
                    {
                        videoIds.map((m, i) =>
                            <div key={i} className="w-[4cm] rounded-lg border border-outline">
                                {/* Remove button */}
                                {
                                    editing &&
                                    <div className="absolute top-0 right-0">
                                        <Ripple className="rounded-full bg-error text-on-error">
                                            <button onClick={async () => leafContext.removeContent(contentIndex, m)}>
                                                <SquareMinus />
                                            </button>
                                        </Ripple>
                                    </div>
                                }

                                <img src={`/api/video/thumbnail/${m}`} crossOrigin="use-credentials" onClick={() => setSelected(m)} className="w-[100vw] border" />
                            </div>
                        )
                    }
                </div>
                {
                    selected &&
                    <video ref={videoRef} controls autoPlay={false} className="w-[100vw]" crossOrigin="use-credentials" />
                }

                <Slide open={openVideoUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
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
