import { useContext, useState } from "react";
import { SquareMinus } from "../assets/icons/SquareMinus";
import { Audio as AudioContent } from "./Content/Audio";
import { Image } from "./Content/Image";
import Text from "./Content/Text";
import { Video } from "./Content/Video";
import { LeafContext } from "./LeafManager";
import { Trash2 } from "../assets/icons/Trash2";
import { Plus } from "../assets/icons/Plus";
import { Button } from "./Button";
import { Volume2 } from "../assets/icons/Volume2";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import { Volume1 } from "../assets/icons/Volume1";
import { CircularProgress } from "./CircularProgress";

export function Content({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const leaf = leafContext.leaf
    const contents = leaf[isTerm ? 'termContents' : 'definitionContents']
    const content = contents[contentIndex]
    const type = content.type
    const values = content.value

    const [newStringContent, setNewStringContent] = useState('')

    const [fetchingSound, setFetchingSound] = useState<number | undefined>(undefined)
    const [playingSound, setPlayingSound] = useState<number | undefined>(undefined)
    const playSound = async (text: string, index: number) => {
        try {
            setFetchingSound(index)
            const response = await jsonAuthFetch("/api/tts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    language: 'de'
                }),
            });
            setFetchingSound(undefined)
            if (response === false)
                return notify('Failed to read text', 3000, 'error')

            const blob = await response.blob();
            console.log({ blob });

            const audioUrl = URL.createObjectURL(blob);

            const audio = new Audio(audioUrl);
            setPlayingSound(index)
            audio.play();
            audio.onended = () => setPlayingSound(undefined)
        } catch (error) {
            console.error(error);
            setFetchingSound(undefined)
            setPlayingSound(undefined)
            notify('Failed to read text', 3000, 'error')
            return false
        }
    }

    return (
        type === 'audioId' ? <AudioContent contentIndex={contentIndex} /> :
            (
                type === 'imageId' ? <Image contentIndex={contentIndex} /> :
                    (
                        type === 'videoId' ? <Video contentIndex={contentIndex} /> :
                            (
                                type === 'richText'
                                    ? <Text contentIndex={contentIndex} />
                                    : (
                                        type === 'string'
                                            ? <div className="flex flex-col gap-2 p-2 w-full border border-outline rounded-lg">
                                                <div className="flex flex-row items-center gap-2 p-2 w-full">
                                                    {/* Delete button */}
                                                    {
                                                        editing &&
                                                        <Button isIcon variant="text" color="error" onPointerDown={async () => leafContext?.removeContents(contentIndex)}>
                                                            <Trash2 />
                                                        </Button>
                                                    }

                                                    <div className="grow" />
                                                </div>

                                                {
                                                    values.map((v, i) =>
                                                        <div key={i} className="rounded-lg border border-outline p-2 flex flex-row items-center gap-2">
                                                            <Button isIcon variant="text" color={playingSound === i ? 'primary' : 'on-surface'} onClick={() => playSound(v, i)}>

                                                                {
                                                                    fetchingSound === i
                                                                        ? <CircularProgress size={20} strokeWidth={1.5} />
                                                                        : playingSound === i
                                                                            ? <Volume2 />
                                                                            : <Volume1 />
                                                                }
                                                            </Button>
                                                            <div className="grow">{v}</div>

                                                            {/* Delete button */}
                                                            {
                                                                editing &&
                                                                <Button isIcon variant="text" color="error" onPointerDown={async () => leafContext?.removeContent(contentIndex, v)}>
                                                                    <SquareMinus className="size-4" />
                                                                </Button>
                                                            }
                                                        </div>
                                                    )
                                                }

                                                {/* Create content */}
                                                {
                                                    editing &&
                                                    <div key={values.length} className="flex flex-row items-center gap-2 p-1 w-full">
                                                        <input
                                                            className="bg-surface rounded-lg border border-outline grow p-2"
                                                            value={newStringContent}
                                                            onChange={(e) => setNewStringContent(e.target.value)}
                                                        />

                                                        <Button isIcon variant="text" color="success" onPointerDown={async () => {
                                                            let l = { ...leaf }
                                                            l[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value.push(newStringContent)

                                                            const result = await leafContext?.updateLeaf(l)
                                                            if (result === false)
                                                                return

                                                            leafContext.onLeafChange(l)
                                                        }}>
                                                            <Plus />
                                                        </Button>
                                                    </div>
                                                }
                                            </div>
                                            : 'error'
                                    )
                            )
                    )
            )
    )
}
