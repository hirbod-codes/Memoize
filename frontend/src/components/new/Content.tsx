import { Audio } from "./Content/Audio/Audio";
import { Image } from "./Content/Image";
import { Video } from "./Content/Video";
import type { Types } from "./PresentLeaf";

export function Content({ type, values }: { type: Types, values: string[] }) {
    return (
        type === 'audioId' ? <Audio audioIds={values} /> :
            (
                type === 'imageId' ? <Image imageIds={values} /> :
                    (
                        type === 'videoId' ? <Video videoIds={values} /> :
                            (
                                type === 'string' ? values :
                                    'error'
                            )
                    )
            )
    )
}
