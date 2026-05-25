import { Ripple } from "../Ripple";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { Trash2 } from "../../assets/icons/Trash2";
import type { Types } from "../LeafManager";
import { X } from "../../assets/icons/X";
import { Button } from "../Button";

export function Upload({ type, onUpload, onClose }: { type: Types, onUpload?: (imageIds: string[]) => void, onClose?: () => void }) {
    const { jsonAuthFetch } = useAuth();

    const [audioFiles, setAudioFiles] = useState<FileList | null>(null);
    const [progress, setProgress] = useState(0)
    const [titles, setTitles] = useState<string[]>([])

    const { notify } = useNotification()

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
        if (!event.target.files) {
            console.log("event?.target?.result is null or undefined!!!")
            return
        }
        if (event.target.files.length > 0) {
            setAudioFiles(event.target.files);

            let ts: string[] = []
            for (let i = 0; i < event.target.files.length; i++) {
                const file = event.target.files.item(i);

                let title = ''
                if (!file)
                    continue
                else
                    title = file.name.split('.')[0]

                ts[i] = title
            }

            setTitles(ts)
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
            const file = audioFiles.item(i);

            if (!file)
                continue

            try {
                let result = await jsonAuthFetch(`/api/${contentType}/?fileName=${file.name}&title=${titles[i]}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
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
                    <button onPointerDown={() => onClose?.()}>
                        <Trash2 />
                    </button>
                </Ripple>

                {/* Close button */}
                <Ripple className="rounded-full p-2">
                    <button onPointerDown={() => onClose?.()}>
                        <X />
                    </button>
                </Ripple>
            </div>

            <div className="w-full rounded">
                <div className="h-1 bg-success rounded transform-gpu transition-all" style={{ width: `${progress}%` }} />
            </div>

            <input type="file" multiple={true} className="hidden" accept={type === 'audioId' ? "audio/*" : (type === 'imageId' ? 'image/*' : (type === 'videoId' ? 'video/*' : undefined))} onChange={handleFileChange} id="audio-upload" />
            <Button color='on-surface' variant="outlined" className="w-full rounded-lg">
                <label
                    htmlFor="audio-upload"
                    className="w-full"
                >
                    <div className="">
                        Browse files
                    </div>
                </label>
            </Button>

            <Button
                variant="outlined"
                color="success"
                className="w-full  rounded-lg"
                disabled={!audioFiles || audioFiles.length === 0}
                onPointerDown={async () => {
                    const data = await massUpload();
                    if (data === false)
                        return

                    onUpload?.(data)

                    onClose?.()
                }}
            >
                Upload
            </Button>

            <div className={`border-b-4 w-full py-2 border-outline-variant`} />

            <div className="flex flex-col gap-2 w-full">
                {
                    inputs.map((v, i) =>
                        <div key={i} className="flex flex-col gap-1">
                            <div className={`flex flex-row items-center py-2 ${(i === inputs.length - 1 ? '' : 'border-b border-outline')}`}>
                                <div>
                                    {v.name}
                                </div>
                                <div className="grow" />
                                <div>
                                    {(v.size / 1000_000).toFixed(2)}Mb
                                </div>
                            </div>

                            <input
                                value={titles[i] ?? ''}
                                onChange={e => setTitles(titles.map((t, ii) => { if (i !== ii) return t; else return e.target.value }))}
                                className="border bg-surface text-on-surface p-2 rounded-md"
                            />
                        </div>
                    )
                }
            </div>
        </div>
    )
}
