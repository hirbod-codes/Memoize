import { useState } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { Ripple } from "../../Ripple";
import { Slide } from "../../Slide";
import { Upload } from "../Upload";
import type { Leaf } from "../../LeafManager";

export function Image({ contentIndex }: { contentIndex: number }) {
    const [openImageUploadModal, setOpenImageUploadModal] = useState(false)

    return (
        !imageIds || imageIds.length === 0
            ? 'No images!'
            : <div className="size-full flex flex-col gap-4 p-2 border overflow-x-auto">
                {
                    editing &&
                    <div className="absolute top-0 right-0 flex flex-row gap-1 p-1">
                        {/* Add button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={async () => setOpenImageUploadModal(true)}>
                                <Plus />
                            </button>
                        </Ripple>

                        {/* Remove button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={() => onRemoveAll?.()}>
                                <Trash2 />
                            </button>
                        </Ripple>
                    </div>
                }

                <div className="size-auto p-2 flex flex-row items-center border">
                    {
                        imageIds.map((m, i) =>
                            <div key={i} className="w-[4cm] rounded-lg border border-outline">
                                {/* Remove button */}
                                {
                                    editing &&
                                    <div className="absolute top-0 right-0">
                                        <Ripple className="rounded-full bg-error text-on-error">
                                            <button onClick={async () => onRemove?.(m)}>
                                                <SquareMinus />
                                            </button>
                                        </Ripple>
                                    </div>
                                }

                                <img src={`/api/image/file/${m}`} crossOrigin="use-credentials" />
                            </div>
                        )
                    }
                </div>

                <Slide open={openImageUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <Upload type='imageId' onClose={() => setOpenImageUploadModal(false)} onUpload={(ids) => onLeafChange?.([...imageIds, ...ids])} />
                </Slide>
            </div>
    )
}
