import { createContext, useEffect, useState } from "react"
import { Content } from "./Content"
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
import { Button } from "./Button"
import { CircularProgress } from "./CircularProgress"
import { ArrowRightLeft } from "../assets/icons/ArrowRightLeft"

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
    updateLeaf: (leaf: Leaf) => Promise<boolean>
    removeContent: (i: number, v: string) => Promise<false | Leaf>
    removeContents: (i: number) => Promise<false | Leaf>
    onLeafChange: (leaf: Leaf) => void
} | undefined>(undefined)

export function LeafManager({ leaf: initLeaf, onLeafChange, onRemove, onClose }: { leaf: Leaf, treeNodeId?: string, onLeafChange: (leaf: Leaf) => void, onRemove?: () => void, onClose?: () => void }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const [leaf, setLeaf] = useState({ ...initLeaf })

    const [isTerm, setIsTerm] = useState<boolean>(true)
    const [editing, setEditing] = useState<boolean>(false)

    const [newTitle, setNewTitle] = useState(initLeaf.title)
    const [newContent, setNewContent] = useState<{ type: Types, value: string[] }>()
    const [openUpload, setOpenUpload] = useState<Types | undefined>(undefined)

    const [saving, setSaving] = useState(false)

    const save = async (l: Leaf) => {
        try {
            console.log('save called', saving);

            setSaving(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'PATCH', body: JSON.stringify({ leaf: l }) })
            setSaving(false)
            if (r === false || !r.ok) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            return true
        } catch (error) {
            setSaving(false)
            console.error(error);
            notify("Failed to update", 3000, 'error')
            return false
        }
    }

    const removeContents = async (i: number) => {
        try {
            if (leaf === undefined || saving)
                return false

            let l = { ...leaf }

            l[isTerm ? 'termContents' : 'definitionContents'] = l[isTerm ? 'termContents' : 'definitionContents'].filter((_f, fi) => fi !== i)

            let r = await save(l)
            if (r === false) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            return l
        } catch (err) {
            setSaving(false)
            console.error(err);
            return false
        }
    }

    const removeContent = async (i: number, v: string) => {
        try {
            if (leaf === undefined)
                return false

            let l = { ...leaf }
            l[isTerm ? 'termContents' : 'definitionContents'][i].value = l[isTerm ? 'termContents' : 'definitionContents'][i].value.filter(f => f !== v)

            if (l[isTerm ? 'termContents' : 'definitionContents'][i].value.length === 0)
                l[isTerm ? 'termContents' : 'definitionContents'] = l[isTerm ? 'termContents' : 'definitionContents'].filter((_f, fi) => fi !== i)

            let r = await save(l)
            if (r === false) {
                notify("Failed to update", 3000, 'error')
                return false
            }

            notify("Successfully updated", 3000, 'success')

            return l
        } catch (err) {
            setSaving(false)
            console.error(err);
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
            removeContent,
            removeContents,
        }}>
            {
                leaf === undefined
                    ? 'nothing'
                    :
                    <div className="flex flex-col items-start gap-2 p-2 bg-surface-container-high text-on-surface rounded-lg overflow-auto max-h-full" onPointerDown={() => (!isTerm)}>
                        <div className="flex flex-row w-full items-center p-2">
                            <Button variant="text" color="primary" className="rounded-lg" onPointerDown={() => setIsTerm(!isTerm)}>
                                <ArrowRightLeft className="inline" /> Flip
                            </Button>
                            <div className="grow" />

                            {/* Close button */}
                            {onClose &&
                                <Button isIcon variant="text" color="on-surface" onPointerDown={async () => onClose?.()}>
                                    <X />
                                </Button>
                            }
                        </div>

                        {/* Buttons */}
                        <div className="flex flex-row items-center w-full p-2">
                            {/* Delete button */}
                            {
                                editing &&
                                <Button isIcon variant="text" color="error" onPointerDown={async () => onRemove?.()}>
                                    <Trash2 />
                                </Button>
                            }

                            <div className="grow" />

                            {/* Switch edit mode button */}
                            <Button isIcon variant="text" color="on-surface" onPointerDown={() => setEditing(!editing)}>
                                {
                                    editing
                                        ? <Eye />
                                        : <SquarePen />
                                }
                            </Button>
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

                                    <Button variant="outlined" color="on-surface"
                                        onPointerDown={async () => {
                                            const result = await save({ ...leaf, title: newTitle })
                                            if (result === false)
                                                return

                                            setLeaf({ ...leaf, title: newTitle })
                                            onLeafChange?.({ ...leaf, title: newTitle })
                                        }}
                                        className="rounded-lg"
                                        disabled={saving}
                                    >
                                        Save
                                    </Button>
                                </div>
                            }
                        </h1>

                        {/* Contents */}
                        <div className="flex flex-col items-start gap-4 p-2 w-full">
                            {
                                leaf[isTerm ? 'termContents' : 'definitionContents']
                                    .map((_content, i: number) =>
                                        <div key={i} className="flex flex-col gap-1 w-full">
                                            <Content contentIndex={i} />
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
                                    <Button variant="outlined" color="success" onPointerDown={async () => {
                                        leaf[isTerm ? 'termContents' : 'definitionContents'].push({ type: 'richText', value: [''] })

                                        setSaving(true)
                                        const result = await save(leaf)
                                        setSaving(false)
                                        if (result === false)
                                            return

                                        onLeafChange?.({ ...leaf })
                                    }}>
                                        {
                                            saving
                                                ? <CircularProgress size={20} strokeWidth={1} className="text-success" />
                                                : [<Plus className="inline" />, 'Add']
                                        }
                                    </Button>
                                }

                                {
                                    newContent.type !== 'string' && newContent.type !== 'richText' &&
                                    <Button variant="outlined" color="success" onPointerDown={() => setOpenUpload(newContent.type)}>
                                        <UploadIcon className='inline' /> Upload
                                    </Button>
                                }

                                <Button
                                    variant="outlined"
                                    color="success"
                                    onPointerDown={async () => {
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
                                >
                                    {
                                        saving
                                            ? <CircularProgress size={20} strokeWidth={1} className="text-success" />
                                            : 'Save'
                                    }
                                </Button>
                            </div>
                        }

                        {/* Add Content button */}
                        {
                            editing &&
                            <div className="flex flex-row items-center justify-center w-full">
                                <Button isIcon variant="text" color='success' onPointerDown={async () => setNewContent({ type: 'string', value: [''] })}>
                                    <Plus className='inline' />
                                </Button>
                            </div>
                        }

                        <Slide open={openUpload !== undefined} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                            <Upload
                                type={openUpload!}
                                onClose={() => setOpenUpload(undefined)}
                                onUpload={async (ids) => {
                                    leaf[isTerm ? 'termContents' : 'definitionContents'].push({ type: openUpload!, value: ids })

                                    const result = await save(leaf)
                                    if (result === false)
                                        return

                                    onLeafChange({ ...leaf })
                                }}
                            />
                        </Slide>
                    </div >
            }
        </LeafContext.Provider>
    )
}
