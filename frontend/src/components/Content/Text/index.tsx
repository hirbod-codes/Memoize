import { useContext } from "react";
import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import { LeafContext } from "../../LeafManager";
import { Ripple } from "../../Ripple";
import { Editor } from "./Editor";


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
                        <Ripple className="rounded-full bg-success text-on-success p-2">
                            <button onClick={async () => {
                                leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value.push('')
                                const result = await leafContext.updateLeaf(leaf)
                                if (result === false)
                                    return

                                leafContext.onLeafChange({ ...leaf });
                            }}>
                                <Plus />
                            </button>
                        </Ripple>

                        {/* Remove button */}
                        <Ripple className="rounded-full bg-error text-on-error p-2">
                            <button onClick={async () => {
                                const result = await leafContext.removeContents(contentIndex)
                                if (result === false)
                                    return

                                leafContext.onLeafChange({ ...leaf });
                            }}>
                                <Trash2 />
                            </button>
                        </Ripple>
                    </div>
                }

                <div className="size-full p-2 flex flex-col gap-4 rounded-lg border border-outline">
                    {
                        jsonStrings.map((m, i) =>
                            <div key={i} className="w-full rounded-lg border border-outline relative">
                                {/* Remove button */}
                                {
                                    editing &&
                                    <div className="absolute top-0 right-0">
                                        <Ripple className="rounded-full bg-error text-on-error p-1">
                                            <button onClick={async () => {
                                                console.log('removeContent', m);

                                                const result = await leafContext.removeContent(contentIndex, m)
                                                console.log({ result });

                                                if (result === false)
                                                    return

                                                leafContext.onLeafChange({ ...result });
                                            }}>
                                                <SquareMinus className="size-4" />
                                            </button>
                                        </Ripple>
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
