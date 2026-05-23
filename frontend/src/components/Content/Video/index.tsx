import { useContext, useState } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { Ripple } from "../../Ripple";
import { Slide } from "../../Slide";
import { Upload } from "../Upload";
import { LeafContext } from "../../LeafManager";
import { VideoPlayer } from "./VideoPlayer";

export function Video({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const videoIds = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value

    const [openVideoUploadModal, setOpenVideoUploadModal] = useState(false)

    return (
        !videoIds || videoIds.length === 0
            ? 'No videos!'
            : <div className="size-full flex flex-col gap-4 p-2 border overflow-x-auto">
                {
                    editing &&
                    <div className="flex flex-row justify-between gap-1 p-2 *:p-2">
                        {/* Remove button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={() => leafContext.removeContents(contentIndex)}>
                                <Trash2 />
                            </button>
                        </Ripple>

                        {/* Add button */}
                        <Ripple className="rounded-full bg-success text-on-success">
                            <button onClick={async () => setOpenVideoUploadModal(true)}>
                                <Plus />
                            </button>
                        </Ripple>
                    </div>
                }

                <div className="size-auto p-2 flex flex-row items-center border">
                    {videoIds.map((m, i) => <VideoPlayer key={i} contentIndex={contentIndex} videoId={m} />)}
                </div>

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
