import { Plus } from "../../../assets/icons/Plus";
import { SquareMinus } from "../../../assets/icons/SquareMinus";
import { Trash2 } from "../../../assets/icons/Trash2";
import type { Leaf } from "../../LeafManager";
import { Ripple } from "../../Ripple";
import { Editor } from "./Editor";


export default function Text({ leaf, contentIndex, jsonContents, editing, onLeafChange, onRemove, onRemoveAll }: { leaf: Leaf, contentIndex: number, jsonContents: string[], editing: boolean, onLeafChange?: (jsonContents: string[]) => void, onRemove?: (v: string) => void, onRemoveAll?: () => void }) {
    return (
        !jsonContents || jsonContents.length === 0
            ? 'No content!'
            : <div className="size-full flex flex-col gap-4 p-2 border">
                {
                    editing &&
                    <div className="absolute top-0 right-0 flex flex-row items-center gap-1 p-1">
                        {/* Add button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={async () => onLeafChange?.([...jsonContents, ''])}>
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

                <div className="size-auto p-2 flex flex-col gap-4 border">
                    {
                        jsonContents.map((m, i) =>
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

                                <Editor leaf={leaf} isTerm contentIndex={contentIndex} valueIndex={i} editable={editing} onLeafChange={(c) => onLeafChange?.([...jsonContents, c])} />
                            </div>
                        )
                    }
                </div>
            </div>
    )
}
