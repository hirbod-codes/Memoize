import { useContext, useState } from "react";
import { SquareMinus } from "../assets/icons/SquareMinus";
import { Audio } from "./Content/Audio";
import { Image } from "./Content/Image";
import Text from "./Content/Text";
import { Video } from "./Content/Video";
import { LeafContext } from "./LeafManager";
import { Trash2 } from "../assets/icons/Trash2";
import { Plus } from "../assets/icons/Plus";
import { Button } from "./Button";

export function Content({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const leaf = leafContext.leaf
    const contents = leaf[isTerm ? 'termContents' : 'definitionContents']
    const content = contents[contentIndex]
    const type = content.type
    const values = content.value

    const [newStringContent, setNewStringContent] = useState('')

    return (
        type === 'audioId' ? <Audio contentIndex={contentIndex} /> :
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
                                                        <div key={i} className="rounded-lg border border-outline p-2 flex flex-row items-center">
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
