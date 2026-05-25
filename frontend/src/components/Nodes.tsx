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
import { Button } from "./Button"
import { SquareMinus } from "../assets/icons/SquareMinus"

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

    const [waitingFor, setWaitingFor] = useState<string | undefined>(undefined)

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

            setWaitingFor(`remove-folder-${id}`)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeId=${id}`, { method: 'DELETE' })
            setWaitingFor(undefined)
            if (r === false || !r.ok)
                return notify('failed to load folders', 3000, 'error')

            return true
        } catch (error) {
            setWaitingFor(undefined)
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

    const removeLeaf = async (id: string) => {
        try {
            if (!id)
                return false

            setWaitingFor(`leaf-remove-${id}`)
            let r = await jsonAuthFetch(`/api/leaf/?id=${id}`, { method: 'DELETE' })
            setWaitingFor(undefined)
            if (r === false || !r.ok) {
                notify('Removing card failed', 3000, 'error')
                return false
            }

            return true
        } catch (error) {
            setWaitingFor(undefined)
            console.error(error);
            notify('Removing card failed', 3000, 'error')
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
            : <div className="size-full relative p-4">
                <div className="size-full flex flex-col gap-2 items-center p-2 overflow-y-auto bg-surface-container rounded-lg">

                    <div className="w-full flex flex-row items-center justify-between">
                        {/* Go back button */}
                        {
                            locationQueue.length > 1 &&
                            <Button variant="text" color="on-surface" isIcon disabled={locationQueue.length <= 1} onPointerDown={async () => {
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
                            </Button>
                        }

                        <div className="grow" />

                        {/* Switch edit mode button */}
                        <Button variant="text" color="on-surface" isIcon onPointerDown={() => setEditing(!editing)}>
                            {
                                editing
                                    ? <Eye />
                                    : <SquarePen />
                            }
                        </Button>
                    </div>

                    {/* title */}
                    <h1 className="w-full text-on-surface">
                        {!editing && parentTreeNode && parentTreeNode.title}

                        {editing && parentTreeNode &&
                            <div className="flex flex-row items-center gap-2">
                                <input
                                    value={newParentTitle}
                                    onChange={(e) => setNewParentTitle(e.target.value)}
                                    className="grow rounded-md p-2 border border-outline bg-surface-variant text-on-surface-variant"
                                />

                                <Button variant="outlined" color="on-surface" className="rounded-md" disabled={changingTreeNode} onClick={async () => {
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
                                </Button>
                            </div>
                        }
                    </h1>

                    {parentTreeNode?.title && <div className="border-b border-outline-variant w-full" />}

                    {/* Tree nodes */}
                    {
                        treeNodes && treeNodes.map((r: any, i: number) => {
                            return (
                                <div
                                    key={i}
                                    className="flex flex-row items-center justify-between w-full rounded-lg bg-surface-container-low hover:bg-surface-container-highest text-on-surface"
                                >
                                    {/* Title */}
                                    <div
                                        className="w-full grow p-2"
                                        onPointerDown={async () => {
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
                                        }}
                                    >
                                        {r.title}
                                    </div>

                                    {/* Delete button */}
                                    {
                                        editing &&
                                        <Button variant="text" color='error' isIcon disabled={waitingFor === `remove-folder-${r._id}`} onClick={async () => { if (await removeTreeNode(r._id)) setTreeNodes(treeNodes.filter(f => f._id !== r._id)); }}>
                                            {
                                                waitingFor === `remove-folder-${r._id}`
                                                    ? 'updating...'
                                                    : <SquareMinus />
                                            }
                                        </Button>
                                    }
                                </div>
                            )
                        })
                    }

                    {leafs.length !== 0 && <div className="border-b border-outline-variant w-full my-8" />}

                    {/* Leafs */}
                    {
                        leafs && leafs.map((r: any, i: number) => {
                            return (
                                <div key={i} className="flex flex-row items-center justify-between w-full rounded-lg p-2 bg-surface-container-low hover:bg-surface-container-highest text-on-surface" onClick={() => setShowingLeaf(i)}>
                                    <div className="w-full grow">
                                        {r.title}
                                    </div>

                                    {/* Delete button */}
                                    {
                                        editing &&
                                        <Button variant="text" color='error' isIcon disabled={waitingFor === `leaf-remove-${r._id}`} onClick={async () => { if (await removeLeaf(r._id)) setLeafs(leafs.filter(f => f._id !== r._id)); }}>
                                            {
                                                waitingFor === `leaf-remove-${r._id}`
                                                    ? 'updating...'
                                                    : <SquareMinus />
                                            }
                                        </Button>
                                    }
                                </div>
                            )
                        })
                    }

                    {/* Add buttons */}
                    {
                        editing &&
                        <div className="absolute bottom-0 right-0 w-full flex flex-row justify-end gap-2 p-2">
                            {/* Add tree node button */}
                            <Button variant='filled' color="success" isIcon onPointerDown={async () => setShowAddTreeNodeModal(true)}>
                                <FolderPlus />
                            </Button>

                            {/* Add leaf button */}
                            {
                                locationQueue[locationQueue.length - 1] !== 'root' &&
                                <Button variant='filled' color="success" isIcon onPointerDown={async () => setShowAddLeafModal(true)}>
                                    <Plus />
                                </Button>
                            }
                        </div>
                    }

                    {/* Add tree node */}
                    <Slide open={showAddTreeNodeModal} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <div className="flex flex-col gap-2 bg-surface-variant rounded-lg p-2">

                            <div className="flex flex-row w-full items-center justify-end">
                                <Button variant='text' isIcon onPointerDown={() => { setNewTreeNodeTitle(''); setShowAddTreeNodeModal(false) }}>
                                    <X />
                                </Button>
                            </div>

                            <input
                                value={newTreeNodeTitle}
                                onChange={(e) => setNewTreeNodeTitle(e.target.value)}
                                className="w-full rounded-lg border border-outline bg-surface-variant text-on-surface-variant p-2"
                                placeholder="Folder title"
                            />

                            <div className="py-2" />

                            <Button icon={<Plus />} variant="outlined" color='success' className="w-full rounded-lg" onClick={async () => {
                                const result = await createTreeNode()
                                if (result === false)
                                    return

                                setTreeNodes([...treeNodes, { _id: result, parentId: locationQueue[locationQueue.length - 1] !== 'root' ? locationQueue[locationQueue.length - 1] : 'undefined', title: newTreeNodeTitle }])

                                setNewTreeNodeTitle('')
                                setShowAddTreeNodeModal(false)
                            }}>
                                Add
                            </Button>

                        </div>
                    </Slide>

                    {/* Create Leaf */}
                    <Slide open={showAddLeafModal} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <div className="flex flex-col gap-2 bg-surface-variant text-surface-variant rounded-lg p-2">
                            <div className="flex flex-row w-full items-center justify-end">
                                <Button variant="text" color='on-surface' isIcon onPointerDown={() => { setNewLeafTitle(''); setShowAddLeafModal(false) }}>
                                    <X />
                                </Button>
                            </div>

                            <input
                                value={newLeafTitle}
                                onChange={(e) => setNewLeafTitle(e.target.value)}
                                className="w-full rounded-lg border border-outline bg-surface-variant text-on-surface-variant p-2"
                                placeholder="New card title"
                            />

                            <div className="p-2" />

                            <Button icon={<Plus />} variant="outlined" color='success' className="w-full rounded-lg" onClick={async () => {
                                if (locationQueue[locationQueue.length - 1] === 'root')
                                    return

                                const id = await createLeaf(locationQueue[locationQueue.length - 1], newLeafTitle)
                                if (id === false)
                                    return

                                setLeafs([...leafs, { _id: id, title: newLeafTitle, definitionContents: [], termContents: [], userId: '' }])

                                setNewLeafTitle('')
                                setShowAddLeafModal(false)
                            }}>
                                Add
                            </Button>

                        </div>
                    </Slide>

                    {/* Leaf manager */}
                    <Slide open={showingLeaf !== undefined} style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        {
                            leafs[showingLeaf!] &&
                            <LeafManager
                                treeNodeId={parentTreeNode?._id}
                                leaf={leafs[showingLeaf!]}
                                onClose={() => setShowingLeaf(undefined)}
                                onLeafChange={l => { leafs[showingLeaf!] = l; setLeafs([...leafs]) }}
                                onRemove={() => setLeafs([...leafs.filter((_, i) => i !== showingLeaf)])}
                            />
                        }
                    </Slide>

                </div>
            </div>
    )
}
