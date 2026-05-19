import { Audio } from "./Content/Audio";
import { Image } from "./Content/Image";
import Text from "./Content/Text";
import { Video } from "./Content/Video";
import type { Types } from "./LeafManager";

export function Content({ type, values, editing, onLeafChange, onRemove, onRemoveAll }: { type: Types, values: string[], editing: boolean, onLeafChange?: (value: string[]) => void, onRemove?: (v: string) => void, onRemoveAll?: () => void }) {
    return (
        type === 'audioId' ? <Audio audioIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
            (
                type === 'imageId' ? <Image imageIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
                    (
                        type === 'videoId' ? <Video videoIds={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
                            (
                                type === 'richText' ? <Text jsonContents={values} onLeafChange={onLeafChange} editing={editing} onRemove={onRemove} onRemoveAll={onRemoveAll} /> :
                                    (type === 'string' ? values : 'error')
                            )
                    )
            )
    )
}
