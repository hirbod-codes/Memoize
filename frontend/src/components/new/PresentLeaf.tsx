import { useState } from "react"
import { Content } from "./Content"

export type Types = 'string' | 'imageId' | 'videoId' | 'audioId'

export type Leaf = {
    _id: string,

    userId: string,

    title: string,

    termContent: { type: Types, value: string[] }[],
    definitionContent: { type: Types, value: string[] }[],
}

export function PresentLeaf({ leaf }: { leaf?: Leaf }) {
    const [showingTerm, setShowingTerm] = useState(false)

    return (
        leaf === undefined
            ? 'nothing'
            :
            <div className="flex flex-col items-start gap-2 p-2" onClick={() => setShowingTerm(!showingTerm)}>
                {leaf.title}

                <div className="flex flex-col items-start gap-2 p-2">
                    {
                        showingTerm
                            ? leaf.termContent.map((m, i: number) =>
                                <Content key={i} type={m.type} content={m.value} />
                            )
                            : leaf.definitionContent.map((m, i: number) =>
                                <Content key={i} type={m.type} content={m.value} />
                            )
                    }
                </div>
            </div>
    )
}
