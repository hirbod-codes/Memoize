import { useContext, useState } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { Ripple } from "../../Ripple";
import { Slide } from "../../Slide";
import { Upload } from "../Upload";
import { LeafContext } from "../../LeafManager";
import { Button } from "../../Button";

export function Image({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const imageIds = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value

    const [openImageUploadModal, setOpenImageUploadModal] = useState(false)
    const [showFullscreen, setShowFullscreen] = useState<string | undefined>(undefined)

    return (
        !imageIds || imageIds.length === 0
            ? 'No images!'
            : <div className="size-full flex flex-col gap-4 p-2 border border-outline rounded-lg">
                {
                    editing &&
                    <div className="w-full flex flex-row items-center justify-between gap-2 p-2 *:p-2">
                        {/* Remove button */}
                        <Button isIcon variant="text" color="error" onPointerDown={() => leafContext.removeContents(contentIndex)}>
                            <Trash2 />
                        </Button>

                        {/* Add button */}
                        <Button isIcon variant="text" color="success" onPointerDown={async () => setOpenImageUploadModal(true)}>
                            <Plus />
                        </Button>
                    </div>
                }

                {/* Images */}
                <div className="w-full overflow-x-auto">
                    <div className="w-fit p-2 flex flex-row items-center gap-2">
                        {
                            imageIds.map((m, i) =>
                                <div key={i} className="w-[4cm] rounded-lg overflow-hidden relative">
                                    {/* Remove button */}
                                    {
                                        editing &&
                                        <Button isIcon variant="text" color="error" className="absolute top-0 right-0" onPointerDown={async () => leafContext.removeContent(contentIndex, m)}>
                                            <SquareMinus className="size-4" />
                                        </Button>
                                    }

                                    <img src={`/api/image/file/${m}`} crossOrigin="use-credentials" className="w-[4cm]" onPointerDown={() => setShowFullscreen(`/api/image/file/${m}`)} />
                                </div>
                            )
                        }
                    </div>
                </div>

                {/* Fullscreen image */}
                {showFullscreen !== undefined &&
                    < div className="absolute top-0 left-0 size-full bg-surface">
                        <img src={showFullscreen} crossOrigin="use-credentials" className="size-full object-contain" onPointerDown={() => setShowFullscreen(undefined)} />
                    </div>
                }

                <Slide open={openImageUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <Upload type='imageId' onClose={() => setOpenImageUploadModal(false)} onUpload={async (ids) => {
                        leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value.push(...ids)

                        const result = await leafContext.updateLeaf(leaf)
                        if (result === false)
                            return

                        leafContext.onLeafChange(leaf);
                    }} />
                </Slide>
            </div >
    )
}
