import { useEffect, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNotification } from "../contexts/NotificationContext"
import { Ripple } from "./Ripple"
import { ChevronLeft } from "../assets/icons/ChevronLeft"
import { Slide } from "./Slide"
import { LeafManager, type Leaf } from "./LeafManager"
import { SquarePen } from "../assets/icons/SquarePen"
import { Eye } from "../assets/icons/Eye"
import { Trash2 } from "../assets/icons/Trash2"
import { Plus } from "../assets/icons/Plus"
import { X } from "../assets/icons/X"
import { FolderPlus } from "../assets/icons/FolderPlus"

export type TreeNode = {
    _id?: string
    userId?: string
    parentId: string
    title: string
}

export function Nodes() {
    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [editing, setEditing] = useState<boolean>(false)

    const [locationQueue, setLocationQueue] = useState<string[]>(['root'])

    const [fetching, setFetching] = useState<boolean>(false)
    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
    const [parentTreeNode, setParentTreeNode] = useState<TreeNode>()
    const [leafs, setLeafs] = useState<Leaf[]>([])

    const [showingLeaf, setShowingLeaf] = useState<number | undefined>(undefined)

    const [showAddTreeNodeModal, setShowAddTreeNodeModal] = useState<boolean>(false)
    const [newTreeNodeTitle, setNewTreeNodeTitle] = useState<string>('')

    const [newLeafTitle, setNewLeafTitle] = useState<string>('')
    const [newParentTitle, setNewParentTitle] = useState<string>(parentTreeNode?.title ?? '')

    const [showAddLeafModal, setShowAddLeafModal] = useState<boolean>(false)

    const [changingTreeNode, setChangingTreeNode] = useState<boolean>(false)

    const createTreeNode = async () => {
        try {
            const body: any = { treeNode: { title: newTreeNodeTitle } }
            if (locationQueue[locationQueue.length - 1] !== 'root')
                body.treeNode.parentId = locationQueue[locationQueue.length - 1]

            setChangingTreeNode(true)
            const r = await jsonAuthFetch(`/api/treeNode`, { method: 'POST', body: JSON.stringify(body) })
            setChangingTreeNode(false)
            if (r === false || !r.ok) {
                if (r && r.status === 400) {
                    const json = await r.json()
                    for (const error of json.errors)
                        notify(error, 3000, 'error')
                    return false
                }

                notify('Failed to create folder', 3000, 'error')
                return false
            }

            const data = await r.json()

            console.log({ data })

            return data.id
        } catch (error) {
            console.error(error);
            notify('Failed to create folder', 3000, 'error')
            return false
        }

    }

    const getTreeNodesByParentId = async (id: string) => {
        try {
            if (!id)
                return false

            setFetching(true)
            const r = await jsonAuthFetch(`/api/treeNode/children/?parentTreeNodeId=${id}`)
            setFetching(false)
            if (r === false || !r.ok) {
                if (r && r.status === 400) {
                    const json = await r.json()
                    for (const error of json.errors)
                        notify(error, 3000, 'error')
                    return false
                }

                notify('failed to load folders', 3000, 'error')
                return false
            }

            const data = await r.json()

            console.log({ data })

            return data
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    const getTreeNodes = async (ids: string[]) => {
        try {
            if (!ids)
                return false

            if (ids.length === 0)
                return []

            setFetching(true)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeIds=${ids.join(',')}`)
            setFetching(false)
            if (r === false || !r.ok)
                return notify('failed to load folders', 3000, 'error')

            const data = await r.json()

            console.log({ data })

            return data
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    const getRoots = async () => {
        try {
            setFetching(true)
            const r = await jsonAuthFetch('/api/treeNode/root')
            setFetching(false)
            if (r === false || !r.ok) {
                notify('failed to load folders', 3000, 'error')
                return false
            }

            const data = await r.json()

            console.log({ data })

            return data
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    const updateTreeNode = async (treeNode: TreeNode) => {
        try {
            setChangingTreeNode(true)
            let r = await jsonAuthFetch(`/api/treeNode`, { method: 'PATCH', body: JSON.stringify({ treeNode }) })
            setChangingTreeNode(false)
            if (r === false || !r.ok) {
                if (r && r.status === 400) {
                    for (const error of await r.json())
                        notify(error, 3000, 'error')
                    return false
                }

                notify('Failed to update folder', 3000, 'error')
                return false
            }

            notify('Successfully updated folder', 3000, 'success')

            const data = await r.json()
            console.log({ data })

            return data.id
        } catch (error) {
            console.error(error);
            notify('Failed to update folder', 3000, 'error')
            return false
        }
    }

    const removeTreeNode = async (id: string) => {
        try {
            if (!id)
                return

            setChangingTreeNode(true)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeId=${id}`, { method: 'DELETE' })
            setChangingTreeNode(false)
            if (r === false || !r.ok)
                return notify('failed to load folders', 3000, 'error')

            return true
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    const createLeaf = async (treeNodeId: string, title: string): Promise<string | false> => {
        try {
            setChangingTreeNode(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'POST', body: JSON.stringify({ leaf: { treeNodeId, title, termContents: [], definitionContents: [] } }) })
            setChangingTreeNode(false)
            if (r === false || !r.ok) {
                notify('Failed to create new card', 3000, 'error')
                return false
            }
            notify('Successfully created new card', 3000, 'success')

            let data = await r.json()
            console.log(data);

            return data.id
        } catch (error) {
            console.error(error);
            notify('Failed to create new card', 3000, 'error')
            return false
        }
    }

    const getLeafsByTreeNodeId = async (id: string) => {
        try {
            if (!id)
                return []

            setFetching(true)
            const r = await jsonAuthFetch(`/api/leaf/?parentTreeNodeId=${id}`)
            setFetching(false)
            if (r === false || !r.ok) {
                notify('failed to load folders', 3000, 'error')
                return false
            }
            const data = await r.json()

            console.log({ data })

            return data
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    useEffect(() => {
        getRoots()
            .then(treeNodes => {
                if (treeNodes !== false)
                    setTreeNodes(treeNodes)
            })
    }, [])

    useEffect(() => {
        if (parentTreeNode)
            setNewParentTitle(parentTreeNode.title)
    }, [parentTreeNode])

    console.log({ locationQueue, treeNodes, leafs, parentTreeNode, showingLeaf, newParentTitle, newLeafTitle })

    return (
        fetching
            ? 'loading...'
            : <div className="size-full relative">
                <div className="size-full flex flex-col gap-2 items-center p-2 overflow-auto">

                    <div className="w-full flex flex-row items-center justify-between">
                        {/* Go back button */}
                        {
                            locationQueue.length > 1 &&
                            <Ripple className="rounded-full">
                                <button className="p-1" disabled={locationQueue.length <= 1} onClick={async () => {
                                    let prev: string | undefined = locationQueue[locationQueue.length - 2]

                                    if (prev === 'root') {
                                        let r = await getRoots()
                                        if (r === false)
                                            return

                                        setTreeNodes(r)
                                        setParentTreeNode(undefined)
                                        setLeafs([])
                                        setLocationQueue(['root'])
                                        return
                                    }

                                    let r = await getTreeNodesByParentId(prev)
                                    if (r === false)
                                        return

                                    let l = await getLeafsByTreeNodeId(prev)
                                    if (l === false)
                                        return


                                    setTreeNodes(r)
                                    setLeafs(l)

                                    locationQueue.pop()
                                    setLocationQueue([...locationQueue])
                                }}>
                                    <ChevronLeft />
                                </button>
                            </Ripple>
                        }

                        <div className="grow" />

                        {/* Switch edit mode button */}
                        <Ripple className="rounded-full border border-outline">
                            <button className="p-2" onClick={() => setEditing(!editing)}>
                                {
                                    editing
                                        ? <Eye />
                                        : <SquarePen />
                                }
                            </button>
                        </Ripple>
                    </div>

                    {/* title */}
                    <h1 className="w-full">
                        {!editing && parentTreeNode && parentTreeNode.title}

                        {editing && parentTreeNode &&
                            <div className="flex flex-row gap-2">
                                <input
                                    value={newParentTitle}
                                    onChange={(e) => setNewParentTitle(e.target.value)}
                                    className="grow rounded p-2 border border-outline bg-surface-variant text-on-surface-variant"
                                />
                                <Ripple className="rounded border border-outline p-2">
                                    <button disabled={changingTreeNode} onClick={async () => {
                                        const result = await updateTreeNode({ ...parentTreeNode, title: newParentTitle })
                                        if (result === false)
                                            return

                                        setParentTreeNode({ ...parentTreeNode, title: newParentTitle })
                                    }}>
                                        {
                                            changingTreeNode
                                                ? 'updating...'
                                                : 'Save'
                                        }
                                    </button>
                                </Ripple>
                            </div>
                        }
                    </h1>

                    {parentTreeNode?.title && <div className="border-b border-outline w-full" />}

                    {/* Tree nodes */}
                    {
                        treeNodes && treeNodes.map((r: any, i: number) => {
                            return (
                                <div key={i} className="flex flex-col gap-2 w-full rounded-lg border border-outline p-2">
                                    <div className="flex flex-row items-center justify-between">
                                        {/* Title */}
                                        <div className="w-full grow" onClick={async () => {
                                            let treeNodes = await getTreeNodesByParentId(r._id)
                                            console.log({ treeNodes })
                                            if (treeNodes === false)
                                                return

                                            let leafs = await getLeafsByTreeNodeId(r._id)
                                            console.log({ leafs })
                                            if (leafs === false)
                                                return

                                            setTreeNodes(treeNodes)
                                            setParentTreeNode(r)
                                            setLeafs(leafs)
                                            setLocationQueue([...locationQueue, r._id])
                                        }}>
                                            {r.title}
                                        </div>

                                        {/* Delete button */}
                                        {
                                            editing &&
                                            <Ripple className="rounded-full bg-error text-on-error p-2">
                                                <button disabled={changingTreeNode} onClick={async () => { if (await removeTreeNode(r._id)) setTreeNodes(treeNodes.filter(f => f._id !== r._id)); }}>
                                                    {
                                                        changingTreeNode
                                                            ? 'updating...'
                                                            : <Trash2 />
                                                    }
                                                </button>
                                            </Ripple>
                                        }
                                    </div>
                                </div>
                            )
                        })
                    }

                    {leafs.length !== 0 && <div className="border-b border-outline w-full mt-8" />}

                    {/* Leafs */}
                    {
                        leafs.map((r: any, i: number) => {
                            return (
                                <div key={i} className="flex flex-col gap-2 w-full rounded-lg border border-outline p-2" onClick={() => setShowingLeaf(i)}>
                                    {r.title}
                                </div>
                            )
                        })
                    }

                    {/* Add buttons */}
                    {
                        editing &&
                        <div className="absolute bottom-0 right-0 w-full flex flex-row justify-end gap-2 p-2">
                            {/* Add tree node button */}
                            <Ripple className="rounded-full bg-success text-on-success p-2">
                                <button onClick={async () => setShowAddTreeNodeModal(true)}>
                                    <FolderPlus />
                                </button>
                            </Ripple>

                            {/* Add leaf button */}
                            {
                                locationQueue[locationQueue.length - 1] !== 'root' &&
                                <Ripple className="rounded-full bg-success text-on-success p-2">
                                    <button onClick={async () => setShowAddLeafModal(true)}>
                                        <Plus />
                                    </button>
                                </Ripple>
                            }
                        </div>
                    }

                    {/* Add tree node */}
                    <Slide open={showAddTreeNodeModal} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <div className="flex flex-col gap-2 bg-surface-variant rounded-lg p-2">

                            <div className="flex flex-row w-full items-center justify-end">
                                <Ripple className="rounded-full">
                                    <button onClick={() => { setNewTreeNodeTitle(''); setShowAddTreeNodeModal(false) }}>
                                        <X />
                                    </button>
                                </Ripple>
                            </div>

                            <input
                                value={newTreeNodeTitle}
                                onChange={(e) => setNewTreeNodeTitle(e.target.value)}
                                className="w-full rounded-lg border border-outline bg-surface-variant text-on-surface-variant p-2"
                                placeholder="Folder title"
                            />

                            <div className="py-2" />

                            <Ripple className="rounded-lg w-full bg-success text-on-success">
                                <button className="w-full" onClick={async () => {
                                    const result = await createTreeNode()
                                    if (result === false)
                                        return

                                    setTreeNodes([...treeNodes, { _id: result, parentId: locationQueue[locationQueue.length - 1] !== 'root' ? locationQueue[locationQueue.length - 1] : 'undefined', title: newTreeNodeTitle }])

                                    setNewTreeNodeTitle('')
                                    setShowAddTreeNodeModal(false)
                                }}>
                                    <Plus className="inline" /> Add
                                </button>
                            </Ripple>

                        </div>
                    </Slide>

                    {/* Create Leaf */}
                    <Slide open={showAddLeafModal} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <div className="flex flex-col gap-2 bg-surface-variant text-surface-variant rounded-lg p-2">

                            <div className="flex flex-row w-full items-center justify-end">
                                <Ripple className="rounded-lg">
                                    <button onClick={() => { setNewLeafTitle(''); setShowAddLeafModal(false) }}>
                                        <X />
                                    </button>
                                </Ripple>
                            </div>

                            <input
                                value={newLeafTitle}
                                onChange={(e) => setNewLeafTitle(e.target.value)}
                                className="w-full rounded-lg border border-outline bg-surface-variant text-on-surface-variant p-2"
                                placeholder="New card title"
                            />

                            <div className="p-2" />

                            <Ripple className="rounded-lg w-full bg-success text-on-success">
                                <button onClick={async () => {
                                    if (locationQueue[locationQueue.length - 1] === 'root')
                                        return

                                    const id = await createLeaf(locationQueue[locationQueue.length - 1], newLeafTitle)
                                    if (id === false)
                                        return

                                    setLeafs([...leafs, { _id: id, title: newLeafTitle, definitionContents: [], termContents: [], userId: '' }])

                                    setNewLeafTitle('')
                                    setShowAddLeafModal(false)
                                }}>
                                    <Plus className="inline" /> Add
                                </button>
                            </Ripple>

                        </div>
                    </Slide>

                    {/* Leaf manager */}
                    <Slide open={showingLeaf !== undefined} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <LeafManager
                            treeNodeId={parentTreeNode?._id}
                            leaf={leafs[showingLeaf!]}
                            onClose={() => setShowingLeaf(undefined)}
                            onLeafChange={l => { leafs[showingLeaf!] = l; setLeafs([...leafs]) }}
                            onRemove={() => setLeafs([...leafs.filter((_, i) => i !== showingLeaf)])}
                        />
                    </Slide>

                </div>
            </div>
    )
}
