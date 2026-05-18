import { useState } from "react";
import { Plus } from "../../../../assets/icons/Plus";
import { SquareMinus } from "../../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../../assets/icons/Trash2";
import { Ripple } from "../../../Ripple";
import { Slide } from "../../Slide";
import { useAuth } from "../../../../contexts/AuthContext";
import { useNotification } from "../../../../contexts/NotificationContext";

export function Image({ imageIds, editing, onLeafChange, onRemove, onRemoveAll }: { imageIds: string[], editing: boolean, onLeafChange?: (imageIds: string[]) => void, onRemove?: (v: string) => void, onRemoveAll?: () => void }) {
    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [openImageUploadModal, setOpenImageUploadModal] = useState(false)
    const [audioFiles, setAudioFiles] = useState<FileList | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        if (!event.target.files) {
            console.log("event?.target?.result is null or undefined!!!")
            return
        }
        if (event.target.files.length > 0)
            setAudioFiles(event.target.files);
    };

    const upload = async () => {
        if (!audioFiles || audioFiles.length <= 0)
            return

        const file = audioFiles[0];

        try {
            let result = await jsonAuthFetch(`/api/image`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
            if (result === false || !result.ok) {
                notify('failed to upload audio file', 3000, 'error')
                return false
            }

            const data = await result.json()
            console.log(data)

            notify('audio file uploaded', 3000, result.ok ? 'success' : 'error')
            return data.imageFileId
        } catch (error) {
            console.error(error);
            notify('failed to upload audio file', 3000, 'error')
            return false
        }
    }

    return (
        !imageIds || imageIds.length === 0
            ? 'No images!'
            : <div className="size-full p-2 border overflow-x-auto">
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
                            <div className="w-[4cm] rounded-lg border border-outline">
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

                                <img key={i} src={`/api/image/file/${m}`} crossOrigin="use-credentials" />
                            </div>
                        )
                    }
                </div>

                <Slide open={openImageUploadModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <div className="flex flex-col gap-2 p-4">
                        <input type="file" multiple={false} className="hidden" accept="image/*" onChange={handleFileChange} id="audio-upload" />
                        <div>
                            <Ripple>
                                <label
                                    htmlFor="audio-upload"
                                    className="w-full"
                                >
                                    <div className="cursor-pointer border rounded p-2">
                                        Browse image file
                                    </div>
                                </label>
                            </Ripple>
                        </div>

                        <Ripple>
                            <button disabled={!audioFiles || audioFiles.length === 0} className="border rounded p-2" onClick={async () => {
                                const id = await upload()
                                if (id === false)
                                    return

                                onLeafChange?.([...imageIds, id])
                            }}>
                                Upload
                            </button>
                        </Ripple>
                    </div>
                </Slide>
            </div>
    )
}
