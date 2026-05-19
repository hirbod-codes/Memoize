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

export function LeafManager({ leaf, treeNodeId, onLeafChange, onRemove, onClose }: { leaf: Leaf, treeNodeId: string, onLeafChange?: (leaf: Leaf) => void, onRemove?: () => void, onClose?: () => void }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const [showingTerm, setShowingTerm] = useState<boolean>(false)
    const [editing, setEditing] = useState<boolean>(false)

    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const save = async (l: Leaf) => {
        try {
            let r
            if (l._id.includes('toBeCreated')) {
                setSaving(true)
                r = await jsonAuthFetch(`/api/leaf`, { method: 'POST', body: JSON.stringify({ treeNodeId, leaf: l }) })
                setSaving(false)
                if (r === false || !r.ok) {
                    notify("Failed to update", 3000, 'error')
                    return false
                }
            } else {
                setSaving(true)
                r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify(l) })
                setSaving(false)
                if (r === false || !r.ok) {
                    notify("Failed to update", 3000, 'error')
                    return false
                }
            }

            notify("Successfully updated", 3000, 'success')

            const data = await r.json()
            console.log(data)

            l._id = data.id
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

        if (await save(leaf))
            onLeafChange?.(leaf)
    }

    const removeContent = async (i: number, v: string) => {
        if (leaf === undefined)
            return

        leaf[showingTerm ? 'termContents' : 'definitionContents'][i].value = leaf[showingTerm ? 'termContents' : 'definitionContents'][i].value.filter(f => f !== v)

        if (await save(leaf))
            onLeafChange?.(leaf)
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
                    <button onClick={() => { save(leaf); }} className="p-1 rounded w-full border border-outline">
                        update
                    </button>
                </Ripple>
            </div >
    )
}
