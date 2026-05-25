import { useContext } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { LeafContext } from "../../LeafManager";
import { Editor } from "./Editor";
import { Button } from "../../Button";


export default function Text({ contentIndex }: { contentIndex: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editing = leafContext.editing
    const jsonStrings = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value
    console.log({
        leaf,
        isTerm,
        editing,
        jsonStrings,
    });

    return (
        !jsonStrings || jsonStrings.length === 0
            ? 'No content!'
            : <div className="size-full flex flex-col gap-4 p-2 border border-outline rounded-lg">
                {
                    editing &&
                    <div className="w-full flex flex-row items-center justify-between gap-2">
                        {/* Add button */}
                        <Button isIcon variant="text" color="success" onPointerDown={async () => {
                            leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value.push('')
                            const result = await leafContext.updateLeaf(leaf)
                            if (result === false)
                                return

                            leafContext.onLeafChange({ ...leaf });
                        }}>
                            <Plus />
                        </Button>

                        {/* Remove button */}
                        <Button isIcon variant="text" color="error" onPointerDown={async () => {
                            const result = await leafContext.removeContents(contentIndex)
                            if (result === false)
                                return

                            leafContext.onLeafChange({ ...leaf });
                        }}>
                            <Trash2 />
                        </Button>
                    </div>
                }

                <div className="size-full p-2 flex flex-col gap-4 rounded-lg">
                    {
                        jsonStrings.map((m, i) =>
                            <div key={i} className="w-full rounded-lg border border-outline relative">
                                {/* Remove button */}
                                {
                                    editing &&
                                    <div className="absolute top-0 right-0">
                                        <Button isIcon variant="text" color="error" onPointerDown={async () => {
                                            console.log('removeContent', m);

                                            const result = await leafContext.removeContent(contentIndex, m)
                                            console.log({ result });

                                            if (result === false)
                                                return

                                            leafContext.onLeafChange({ ...result });
                                        }}>
                                            <SquareMinus className="size-4" />
                                        </Button>
                                    </div>
                                }

                                <Editor contentIndex={contentIndex} valueIndex={i} />
                            </div>
                        )
                    }
                </div>
            </div>
    )
}
