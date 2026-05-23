import { Ripple } from "../Ripple";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Trash2 } from "../../assets/icons/Trash2";
import type { Types } from "../LeafManager";
import { X } from "../../assets/icons/X";

export function Upload({ type, onUpload, onClose }: { type: Types, onUpload?: (imageIds: string[]) => void, onClose?: () => void }) {
    const { jsonAuthFetch } = useAuth();

    const [audioFiles, setAudioFiles] = useState<FileList | null>(null);
    const [progress, setProgress] = useState(0)
    const [title, setTitle] = useState('')

    const { notify } = useNotification()

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        if (!event.target.files) {
            console.log("event?.target?.result is null or undefined!!!")
            return
        }
        if (event.target.files.length > 0) {
            setAudioFiles(event.target.files);
            setProgress(0)
        }
    }

    const massUpload = async () => {
        if (!audioFiles || audioFiles.length <= 0)
            return false

        let contentType = ''
        switch (type) {
            case 'imageId':
                contentType = 'image'
                break;

            case 'audioId':
                contentType = 'audio'
                break;

            case 'videoId':
                contentType = 'video'
                break;

            default:
                throw new Error('Invalid type provided')
        }

        let ids: string[] = []
        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];

            try {
                let result = await jsonAuthFetch(`/api/${contentType}/?fileName=${file.name}&title=${title}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
                if (result === false || !result.ok) {
                    notify('failed to upload audio file', 3000, 'error')
                    return false
                }

                const data = await result.json()

                console.log(data)

                ids.push(data.id)

                notify(`${file.name} audio file, uploaded`, 3000, result.ok ? 'success' : 'error')
            } catch (error) {
                console.error(error);
                notify('failed to upload audio file', 3000, 'error')
                return false
            }

            setProgress(((i + 1) / audioFiles.length) * 100)
        }

        return ids
    }

    console.log({ audioFiles, progress })

    const inputs: { name: string, size: number }[] = []
    if (audioFiles && audioFiles.length !== 0)
        for (const file of audioFiles)
            inputs.push({ name: file.name, size: file.size })

    return (
        <div className="flex flex-col gap-2 w-full rounded-lg p-4 items-center overflow-auto bg-surface">
            <div className="flex flex-row gap-2 items-center justify-between w-full">
                {/* Remove button */}
                <Ripple className="rounded-full p-2 bg-error text-on-error">
                    <button onClick={() => onClose?.()}>
                        <Trash2 />
                    </button>
                </Ripple>

                {/* Close button */}
                <Ripple className="rounded-full p-2">
                    <button onClick={() => onClose?.()}>
                        <X />
                    </button>
                </Ripple>
            </div>

            <div className="w-full rounded">
                <div className="h-1 bg-success rounded transform-gpu transition-all" style={{ width: `${progress}%` }} />
            </div>

            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border border-outline rounded-lg p-2 w-full bg-surface-variant text-on-surface-variant"
                placeholder='Title...'
            />

            <input type="file" multiple={true} className="hidden" accept={type === 'audioId' ? "audio/*" : (type === 'imageId' ? 'image/*' : (type === 'videoId' ? 'video/*' : undefined))} onChange={handleFileChange} id="audio-upload" />
            <Ripple className="w-full cursor-pointer border border-outline rounded-lg p-2">
                <label
                    htmlFor="audio-upload"
                    className="w-full"
                >
                    <div className="">
                        Browse files
                    </div>
                </label>
            </Ripple>

            <Ripple className="w-full *:w-full cursor-pointer border rounded-lg p-2">
                <button disabled={!audioFiles || audioFiles.length === 0} onClick={async () => {
                    const data = await massUpload();
                    if (data === false)
                        return

                    onUpload?.(data)

                    onClose?.()
                }}>
                    Upload
                </button>
            </Ripple>

            <div className={`border-b-4 w-full py-2 border-outline`} />

            <div className="flex flex-col gap-2 w-full">
                {
                    inputs.map((v, i) =>
                        <div key={i} className={`flex flex-row items-center py-2 ${(i === inputs.length - 1 ? '' : 'border-b border-outline')}`}>
                            <div>
                                {v.name}
                            </div>
                            <div className="grow" />
                            <div>
                                {(v.size / 1000_000).toFixed(2)}Mb
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    )
}
