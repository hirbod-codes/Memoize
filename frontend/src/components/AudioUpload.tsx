import { useState } from "react";
import { useNotification } from "../contexts/NotificationContext";
import { useAuth } from "../contexts/AuthContext";
import { Ripple } from "./Ripple";

export function AudioUpload() {
    const { jsonAuthFetch } = useAuth();

    const [audioFiles, setAudioFiles] = useState<FileList | null>(null);
    const [progress, setProgress] = useState(0)

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
    };

    const massUpload = async () => {
        if (!audioFiles || audioFiles.length <= 0)
            return

        for (let i = 0; i < audioFiles.length; i++) {
            const file = audioFiles[i];

            try {
                let result = await jsonAuthFetch(`/api/audio/upload?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
                if (result === false || !result.ok) {
                    notify('failed to upload audio file', 3000, 'error')
                    return
                } else
                    notify('audio file uploaded', 3000, result.ok ? 'success' : 'error')
            } catch (error) {
                console.error(error);
                notify('failed to upload audio file', 3000, 'error')
            }

            setProgress(((i + 1) / audioFiles.length) * 100)
        }
    }

    console.log({ audioFiles, progress })

    const inputs: { name: string, size: number }[] = []
    if (audioFiles && audioFiles.length !== 0)
        for (const file of audioFiles)
            inputs.push({ name: file.name, size: file.size })

    return (
        <div className="flex flex-col gap-2 w-full h-full rounded-t-2xl p-4 items-center overflow-auto">
            <div className="w-full rounded">
                <div className="h-1 bg-success rounded transform-gpu transition-all" style={{ width: `${progress}%` }} />
            </div>

            <input type="file" multiple={true} className="hidden" accept="audio/*" onChange={handleFileChange} id="audio-upload" />
            <div>
                <Ripple>
                    <label
                        htmlFor="audio-upload"
                        className="w-full"
                    >
                        <div className="cursor-pointer border rounded p-2">
                            Browse audio files
                        </div>
                    </label>
                </Ripple>
            </div>

            <div>
                <Ripple>
                    <button disabled={!audioFiles || audioFiles.length === 0} className="border rounded p-2" onClick={massUpload}>
                        Mass Upload
                    </button>
                </Ripple>
            </div>

            <div className={`border-b-4 w-full py-2 border-outline`} />

            <div className="flex flex-col gap-2">
                {
                    inputs.map((v, i) =>
                        <div key={i} className={`flex flex-row items-center py-2 ${(i === inputs.length - 1 ? '' : 'border-b border-outline')}`}>
                            <div>
                                {v.name}
                            </div>
                            <div className="grow" />
                            <div>
                                {(v.size / 1000_000).toFixed(0)}Mb
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    )
}
