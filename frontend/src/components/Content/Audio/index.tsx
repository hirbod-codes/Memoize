import { useState } from "react"
import { SquareMinus } from "../../../assets/icons/SquareMinus"
import { Ripple } from "../../Ripple"
import { Slide } from "../../Slide"
import { Upload } from "../Upload"
import { Plus } from "../../../assets/icons/Plus"
import { Trash2 } from "../../../assets/icons/Trash2"
import { AudioPlayer } from "./AudioPlayer"

export function Audio({ audioIds, editing, onLeafChange, onRemove, onRemoveAll }: { audioIds: string[], editing: boolean, onLeafChange?: (audioIds: string[]) => void, onRemove?: (audioId: string) => void, onRemoveAll?: () => void }) {
    const [openAudioUploadModal, setOpenAudioUploadModal] = useState(false)

    return (
        !audioIds || audioIds.length === 0
            ? 'No Audios!'
            : <div className="size-full flex flex-col gap-4 p-2 border overflow-x-auto">
                {
                    editing &&
                    <div className="absolute top-0 right-0 flex flex-row gap-1 p-1">
                        {/* Add button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={async () => setOpenAudioUploadModal(true)}>
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
                        audioIds.map((m, i) =>
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

                                <AudioPlayer audioId={m} />
                            </div>
                        )
                    }
                </div>

                <Slide open={openAudioUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <Upload type='audioId' onClose={() => setOpenAudioUploadModal(false)} onUpload={(ids) => onLeafChange?.([...audioIds, ...ids])} />
                </Slide>
            </div>
    )
}
