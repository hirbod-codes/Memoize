import { SquareMinus } from "../assets/icons/SquareMinus";
import { Audio } from "./Content/Audio";
import { Image } from "./Content/Image";
import Text from "./Content/Text";
import { Video } from "./Content/Video";
import type { Leaf, Types } from "./LeafManager";
import { Ripple } from "./Ripple";

export function Content({ leaf, type, values, contentIndex, editing, onLeafChange, onRemove, onRemoveAll }: { leaf: Leaf, type: Types, values: string[], contentIndex: number, editing: boolean, onLeafChange?: (value: string[]) => void, onRemove?: (v: string) => void, onRemoveAll?: () => void }) {
    return (
        type === 'audioId' ? <Audio audioIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
            (
                type === 'imageId' ? <Image imageIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
                    (
                        type === 'videoId' ? <Video videoIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
                            (
                                type === 'richText'
                                    ? <Text leaf={leaf} contentIndex={contentIndex} jsonContents={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} />
                                    : (
                                        type === 'string'
                                            ? <div className="flex flex-col gap-2 p-2 w-full">
                                                {
                                                    values.map((v, i) =>
                                                        <div key={i} className="rounded-lg border border-outline p-2 flex flex-row items-center">
                                                            <div className="grow">{v}</div>

                                                            {/* Delete button */}
                                                            {
                                                                editing &&
                                                                <Ripple className="rounded-full text-error p-1">
                                                                    <button onClick={async () => onRemove?.(v)}>
                                                                        <SquareMinus />
                                                                    </button>
                                                                </Ripple>
                                                            }
                                                        </div>
                                                    )
                                                }
                                            </div>
                                            : 'error'
                                    )
                            )
                    )
            )
    )
}
