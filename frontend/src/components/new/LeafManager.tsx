import { useEffect, useState } from "react"
import { Content } from "./Content"
import { Ripple } from "../Ripple"
import { Trash2 } from "../../assets/icons/Trash2"
import { useNotification } from "../../contexts/NotificationContext"
import { useAuth } from "../../contexts/AuthContext"
import { X } from "../../assets/icons/X"
import { Eye } from "../../assets/icons/Eye"
import { SquarePen } from "../../assets/icons/SquarePen"

export type Types = 'string' | 'imageId' | 'videoId' | 'audioId' | 'richText'

export type Content = { type: Types, value: string[] }

export type Leaf = {
    _id: string,

    userId: string,

    title: string,

    termContents: Content[],
    definitionContents: Content[],
}

export function LeafManager({ leaf: initLeaf, onLeafChange, onRemove, onClose }: { leaf: Leaf, treeNodeId?: string, onLeafChange?: (leaf: Leaf) => void, onRemove?: () => void, onClose?: () => void }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const [leaf, setLeaf] = useState(initLeaf)

    const [showingTerm, setShowingTerm] = useState<boolean>(false)
    const [editing, setEditing] = useState<boolean>(false)

    const [hasSaved, setHasSaved] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const save = async (l: Leaf) => {
        try {
            setSaving(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify(l) })
            setSaving(false)
            if (r === false || !r.ok) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            setHasSaved(true)

            const data = await r.json()
            console.log(data)

            onLeafChange?.(l)

            return true
        } catch (error) {
            console.error(error);
            notify("Failed to update", 3000, 'error')
            return false
        }
    }

    const removeAllContent = async (i: number) => {
        if (leaf === undefined)
            return

        leaf[showingTerm ? 'termContents' : 'definitionContents'] = leaf[showingTerm ? 'termContents' : 'definitionContents'].filter((_f, fi) => fi !== i)

        setLeaf(leaf)
    }

    const removeContent = async (i: number, v: string) => {
        if (leaf === undefined)
            return

        leaf[showingTerm ? 'termContents' : 'definitionContents'][i].value = leaf[showingTerm ? 'termContents' : 'definitionContents'][i].value.filter(f => f !== v)

        setLeaf(leaf)
    }

    const removeLeaf = async () => {
        try {
            if (!leaf || !leaf._id)
                return

            setDeleting(true)
            let r = await jsonAuthFetch(`/api/leaf/?id=${leaf._id}`, { method: 'DELETE' })
            setDeleting(false)
            if (r === false || !r.ok)
                return notify('Removing card failed', 3000, 'error')

            onRemove?.()

            return true
        } catch (error) {
            console.error(error);
            notify('Removing card failed', 3000, 'error')
            return false
        }
    }

    useEffect(() => {
        if (!editing)
            if (!hasSaved)
                setLeaf(initLeaf)
            else
                setHasSaved(false)
    }, [editing])

    return (
        leaf === undefined
            ? 'nothing'
            :
            <div className="flex flex-col items-start gap-2 p-2" onClick={() => setShowingTerm(!showingTerm)}>
                {/* Switch edit mode button */}
                <Ripple className="rounded-full">
                    <button onClick={() => setEditing(!editing)}>
                        {
                            editing
                                ? <Eye />
                                : <SquarePen />
                        }
                    </button>
                </Ripple>

                {editing &&
                    <div className="flex flex-row items-center justify-between">
                        {/* Delete button */}
                        <Ripple className="rounded-full bg-error text-on-error">
                            <button onClick={async () => removeLeaf()}>
                                <Trash2 />
                            </button>
                        </Ripple>

                        {onClose &&
                            <Ripple className="rounded-full">
                                <button onClick={async () => onClose?.()}>
                                    <X />
                                </button>
                            </Ripple>
                        }
                    </div>
                }

                {/* title */}
                <h1 className="relative">
                    {!editing && leaf.title}

                    {editing &&
                        <input
                            value={leaf.title}
                            onChange={(e) => setLeaf({ ...leaf, title: e.target.value.trim() })}
                            className="w-full rounded p-2 border border-outline bg-surface-variant text-on-surface-variant"
                        />
                    }
                </h1>


                <div className="flex flex-col items-start gap-2 p-2">
                    {
                        leaf[showingTerm ? 'termContents' : 'definitionContents']
                            .map((content, i: number) =>
                                <Content
                                    key={i}
                                    type={content.type}
                                    values={content.value}
                                    editing={editing}
                                    onRemoveAll={() => removeAllContent(i)}
                                    onRemove={(v) => removeContent(i, v)}
                                    onLeafChange={(value) => { leaf[showingTerm ? 'termContents' : 'definitionContents'][i].value = value; setLeaf(leaf); }}
                                />
                            )
                    }
                </div>

                <Ripple>
                    <button onClick={async () => save(leaf)} className="p-1 rounded w-full border border-outline">
                        Save
                    </button>
                </Ripple>
            </div >
    )
}
