import { createContext, useEffect, useState } from "react"
import { Content } from "./Content"
import { Ripple } from "./Ripple"
import { Trash2 } from "../assets/icons/Trash2"
import { useNotification } from "../contexts/NotificationContext"
import { useAuth } from "../contexts/AuthContext"
import { X } from "../assets/icons/X"
import { Upload as UploadIcon } from "../assets/icons/Upload"
import { Eye } from "../assets/icons/Eye"
import { SquarePen } from "../assets/icons/SquarePen"
import { Slide } from "./Slide"
import { Upload } from "./Content/Upload"
import { Plus } from "../assets/icons/Plus"
import { Select } from "./Select"
import Text from "./Content/Text"

export type Types = 'string' | 'imageId' | 'videoId' | 'audioId' | 'richText'

export type Content = { type: Types, value: string[] }

export type Leaf = {
    _id: string,

    userId?: string,

    title: string,

    termContents: Content[],
    definitionContents: Content[],
}

export const LeafContext = createContext<{
    leaf: Leaf,
    isTerm: boolean
    editing: boolean
    updateLeaf: (leaf: Leaf) => Promise<boolean>,
    removeLeaf: () => Promise<boolean>
    removeContent: (i: number, v: string) => Promise<boolean>
    removeContents: (i: number) => Promise<boolean>
    onLeafChange: (leaf: Leaf) => void
} | undefined>(undefined)

export function LeafManager({ leaf: initLeaf, onLeafChange, onRemove, onClose }: { leaf: Leaf, treeNodeId?: string, onLeafChange: (leaf: Leaf) => void, onRemove?: () => void, onClose?: () => void }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const [leaf, setLeaf] = useState({ ...initLeaf })

    const [isTerm,] = useState<boolean>(true)
    const [editing, setEditing] = useState<boolean>(false)

    const [newTitle, setNewTitle] = useState(initLeaf.title)
    const [newContent, setNewContent] = useState<{ type: Types, value: string[] }>()
    const [openUpload, setOpenUpload] = useState<Types | undefined>(undefined)

    const [saving, setSaving] = useState(false)

    const save = async (l: Leaf) => {
        try {
            if (saving)
                return false

            setSaving(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify({ leaf: l }) })
            setSaving(false)
            if (r === false || !r.ok) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            onLeafChange?.(l)

            return true
        } catch (error) {
            console.error(error);
            notify("Failed to update", 3000, 'error')
            return false
        }
    }

    const removeContents = async (i: number) => {
        try {
            if (leaf === undefined || saving)
                return false

            leaf[isTerm ? 'termContents' : 'definitionContents'] = leaf[isTerm ? 'termContents' : 'definitionContents'].filter((_f, fi) => fi !== i)

            setSaving(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify({ leaf }) })
            setSaving(false)
            if (r === false || !r.ok) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            onLeafChange?.({ ...leaf })

            return true
        } catch (err) {
            console.error(err);
            return false
        }
    }

    const removeContent = async (i: number, v: string) => {
        if (leaf === undefined)
            return false

        leaf[isTerm ? 'termContents' : 'definitionContents'][i].value = leaf[isTerm ? 'termContents' : 'definitionContents'][i].value.filter(f => f !== v)

        if (leaf[isTerm ? 'termContents' : 'definitionContents'][i].value.length === 0)
            leaf[isTerm ? 'termContents' : 'definitionContents'] = leaf[isTerm ? 'termContents' : 'definitionContents'].filter((_f, fi) => fi !== i)

        setSaving(true)
        let r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify({ leaf }) })
        setSaving(false)
        if (r === false || !r.ok) {
            notify("Failed to update", 3000, 'error')
            return false
        }

        notify("Successfully updated", 3000, 'success')

        onLeafChange?.({ ...leaf })

        return true
    }

    const removeLeaf = async () => {
        try {
            if (!leaf || !leaf._id)
                return false

            setSaving(true)
            let r = await jsonAuthFetch(`/api/leaf/?id=${leaf._id}`, { method: 'DELETE' })
            setSaving(false)
            if (r === false || !r.ok) {
                notify('Removing card failed', 3000, 'error')
                return false
            }

            onRemove?.()

            return true
        } catch (error) {
            console.error(error);
            notify('Removing card failed', 3000, 'error')
            return false
        }
    }

    useEffect(() => {
        setLeaf(initLeaf)
    }, [initLeaf])

    useEffect(() => {
        setNewTitle(leaf.title)
    }, [leaf])

    console.log({ initLeaf, leaf, isTerm, newContent });

    return (
        <LeafContext.Provider value={{
            leaf,
            isTerm,
            editing,
            updateLeaf: save,
            onLeafChange,
            removeLeaf,
            removeContent,
            removeContents,
        }}>
            {
                leaf === undefined
                    ? 'nothing'
                    :
                    <div className="flex flex-col items-start gap-2 p-2 bg-surface-variant text-on-surface-variant rounded-lg overflow-auto max-h-full" onClick={() => (!isTerm)}>
                        {/* Close button */}
                        <div className="flex flex-row w-full items-center p-2">
                            <div className="grow" />

                            {onClose &&
                                <Ripple className="rounded-full">
                                    <button onClick={async () => onClose?.()}>
                                        <X />
                                    </button>
                                </Ripple>
                            }
                        </div>

                        <div className="flex flex-row items-center w-full p-2">
                            {/* Delete button */}
                            {
                                editing &&
                                <Ripple className="rounded-full bg-error text-on-error p-1">
                                    <button onClick={async () => removeLeaf()}>
                                        <Trash2 />
                                    </button>
                                </Ripple>
                            }

                            <div className="grow" />

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
                        </div>

                        {/* title */}
                        <h1 className="relative w-full">
                            {!editing && leaf.title}

                            {!editing && <div className="border-b border-outline w-full" />}

                            {
                                editing &&
                                <div className="flex flex-row items-center gap-1">
                                    <input
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="w-full rounded-lg p-2 border border-outline bg-surface text-on-surface"
                                    />
                                    <button
                                        onClick={async () => {
                                            const result = await save({ ...leaf, title: newTitle })
                                            if (result === false)
                                                return

                                            setLeaf({ ...leaf, title: newTitle })
                                            onLeafChange?.({ ...leaf, title: newTitle })
                                        }}
                                        className="p-2 rounded-lg border border-success text-success disabled:border-outline disabled:text-on-surface-variant"
                                        disabled={saving}
                                    >
                                        Save
                                    </button>
                                </div>
                            }
                        </h1>

                        {/* Contents */}
                        <div className="flex flex-col items-start gap-2 p-2 w-full">
                            {
                                leaf[isTerm ? 'termContents' : 'definitionContents']
                                    .map((_content, i: number, arr) =>
                                        <div key={i} className="flex flex-col gap-1 w-full">
                                            <Content contentIndex={i} />

                                            {i !== arr.length - 1 && <div className="w-full border-b border-outline" />}
                                        </div>
                                    )
                            }
                        </div>

                        {/* New content */}
                        {
                            editing && newContent &&
                            <div className="w-full flex flex-col gap-4 p-2 bg-surface rounded-lg">
                                <Select
                                    onChange={(e) => {
                                        setNewContent({ type: e.target.value as any, value: [''] })
                                    }}
                                    containerProps={{
                                        className: 'border border-outline p-2 flex flex-row justify-between items-center gap-2 bg-surface-variant rounded-lg'
                                    }}
                                    selectProps={{
                                        className: 'bg-surface text-on-surface rounded-lg p-1'
                                    }}
                                >
                                    <option className="string" value='string'>string</option>
                                    <option className="richText" value='richText'>Rich text</option>
                                    <option className="imageId" value='imageId'>Image</option>
                                    <option className="audioId" value='audioId'>Audio</option>
                                    <option className="videoId" value='videoId'>Video</option>
                                </Select>

                                {
                                    newContent.type === 'string' &&
                                    <input
                                        value={newContent.value[0]}
                                        onChange={(e) => setNewContent({ ...newContent, value: [e.target.value] })}
                                        className="p-2 rounded-lg bg-surface-variant border border-outline w-full"
                                        placeholder="Your content..."
                                    />
                                }

                                {
                                    newContent.type === 'richText' &&
                                    <button className="border border-outline rounded-lg w-full p-1" onClick={async () => {
                                        leaf[isTerm ? 'termContents' : 'definitionContents'].push({ type: 'richText', value: [''] })

                                        setSaving(true)
                                        const result = await save(leaf)
                                        setSaving(true)
                                        if (result === false)
                                            return

                                        onLeafChange?.({ ...leaf })
                                    }}>
                                        <Plus className="inline" /> Add
                                    </button>
                                }

                                {
                                    newContent.type !== 'string' && newContent.type !== 'richText' &&
                                    <button className="border border-outline rounded-lg w-full p-1" onClick={() => setOpenUpload(newContent.type)}>
                                        <UploadIcon className='inline' /> Upload
                                    </button>
                                }

                                <Ripple>
                                    <button
                                        onClick={async () => {
                                            let l = { ...leaf }
                                            if (isTerm)
                                                l.termContents.push(newContent)
                                            else
                                                l.definitionContents.push(newContent)

                                            const result = await save(l)
                                            if (result === false)
                                                return

                                            setLeaf({ ...l })
                                            onLeafChange?.({ ...leaf, title: newTitle })
                                            setNewContent(undefined)
                                        }}
                                        className="p-1 rounded-lg w-full border border-success text-success"
                                    >
                                        Save
                                    </button>
                                </Ripple>
                            </div>
                        }

                        {/* Add Content button */}
                        {
                            editing &&
                            <div className="flex flex-row items-center justify-end w-full">
                                <Ripple>
                                    <button onClick={async () => setNewContent({ type: 'string', value: [''] })} className="p-1 rounded-full w-full bg-success text-on-success">
                                        <Plus className='inline' />
                                    </button>
                                </Ripple>
                            </div>
                        }

                        <Slide open={openUpload !== undefined} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                            <Upload
                                type={openUpload!}
                                onClose={() => setOpenUpload(undefined)}
                                onUpload={() => { }}
                            />
                        </Slide>
                    </div >
            }
        </LeafContext.Provider>
    )
}
