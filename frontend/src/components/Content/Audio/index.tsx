import { useContext, useState } from "react"
import { SquareMinus } from "../../../assets/icons/SquareMinus"
import { Ripple } from "../../Ripple"
import { Slide } from "../../Slide"
import { Upload } from "../Upload"
import { Plus } from "../../../assets/icons/Plus"
import { Trash2 } from "../../../assets/icons/Trash2"
import { AudioPlayer } from "./AudioPlayer"
import { LeafContext } from "../../LeafManager"

export function Audio({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const audioIds = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value

    const [openAudioUploadModal, setOpenAudioUploadModal] = useState(false)

    return (
        !audioIds || audioIds.length === 0
            ? 'No Audios!'
            : <div className="size-full flex flex-col gap-4 p-2 border border-outline rounded-lg">
                {
                    editing &&
                    <div className="flex flex-row items-center justify-between gap-2 p-2 *:p-2">
                        {/* Remove button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={() => leafContext.removeContents(contentIndex)}>
                                <Trash2 />
                            </button>
                        </Ripple>

                        {/* Add button */}
                        <Ripple className="rounded-full bg-success text-on-success">
                            <button onClick={async () => setOpenAudioUploadModal(true)}>
                                <Plus />
                            </button>
                        </Ripple>
                    </div>
                }

                <div className="w-full overflow-x-auto">
                    <div className="w-fit p-2 flex flex-row items-center gap-2">
                        {
                            audioIds.map((m, i) =>
                                <div key={i} className="w-[4cm] rounded-lg border border-outline relative">
                                    {/* Remove button */}
                                    {
                                        editing &&
                                        <div className="absolute top-0 right-0">
                                            <Ripple className="rounded-full bg-error text-on-error p-1">
                                                <button onClick={async () => leafContext.removeContent(contentIndex, m)}>
                                                    <SquareMinus className="size-4" />
                                                </button>
                                            </Ripple>
                                        </div>
                                    }

                                    <div className="h-96">
                                        <AudioPlayer audioId={m} />
                                    </div>
                                </div>
                            )
                        }
                    </div>
                </div>

                <Slide open={openAudioUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <Upload type='audioId' onClose={() => setOpenAudioUploadModal(false)} onUpload={async (ids) => {
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
