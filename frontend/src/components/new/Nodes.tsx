import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useNotification } from "../../contexts/NotificationContext"
import { Ripple } from "../Ripple"
import { ChevronLeft } from "../../assets/icons/ChevronLeft"
import { Slide } from "./Slide"
import { LeafManager, type Leaf } from "./LeafManager"
import { SquarePen } from "../../assets/icons/SquarePen"
import { Eye } from "../../assets/icons/Eye"
import { Trash2 } from "../../assets/icons/Trash2"
import { Plus } from "../../assets/icons/Plus"
import { X } from "../../assets/icons/X"
import { FolderPlus } from "../../assets/icons/FolderPlus"

export type TreeNode = {
    _id?: string
    root: boolean
    title: string
    treeNodeIds: string[]
    leafIds: string[]
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

    const [creatingLeaf, setCreatingLeaf] = useState(false)
    const [showAddLeafModal, setShowAddLeafModal] = useState<boolean>(false)
    const [newLeafTitle, setNewLeafTitle] = useState<string>('')

    const addNewTreeNode = async () => {
        try {
            setFetching(true)
            const r = await jsonAuthFetch(`/api/treeNode`, { method: 'POST', body: JSON.stringify({ treeNode: { root: false, title: newTreeNodeTitle, treeNodeIds: [], leafIds: [] } }) })
            setFetching(false)
            if (r === false || !r.ok)
                return notify('failed to load folders', 3000, 'error')

            const data = await r.json()

            console.log({ data })

            return data.id
        } catch (error) {
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }

    }

    const getLeafs = async (ids: string[]) => {
        try {
            if (ids.length === 0)
                return []

            setFetching(true)
            const r = await jsonAuthFetch(`/api/leaf/?leafIds=${ids.join(',')}`)
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

    const getTreeNodes = async (ids: string[]) => {
        try {
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

    const removeTreeNode = async (id: string) => {
        try {
            setFetching(true)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeIds=${id}`, { method: 'DELETE' })
            setFetching(false)
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
            setCreatingLeaf(true)
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'POST', body: JSON.stringify({ treeNodeId, leaf: { title, termContents: [], definitionContents: [] } }) })
            setCreatingLeaf(false)
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

    const save = async () => {
        try {


            return true
        } catch (error) {
            console.error(error);
            return false
        }
    }

    useEffect(() => {
        getRoots()
            .then(treeNodes => {
                setTreeNodes(treeNodes)
            })
    }, [])

    console.log({ locationQueue, treeNodes, parentTreeNode })

    return (
        fetching
            ? 'loading...'
            : <div className="flex flex-col gap-2 size-full items-start p-2">

                <div className="flex flex-row items-center justify-between">
                    {/* Go back button */}
                    <Ripple className="rounded-full">
                        <button disabled={locationQueue.length > 1} onClick={async () => {
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

                            let d = await getTreeNodes([prev])
                            if (d === false || !d[0])
                                return

                            let r = await getTreeNodes(d[0].treeNodeIds)
                            if (r === false)
                                return

                            let l = await getLeafs(d[0].leafIds)
                            if (l === false)
                                return

                            setTreeNodes(r)
                            setParentTreeNode(d[0])
                            setLeafs(l)

                            locationQueue.pop()
                            setLocationQueue(locationQueue)
                        }}>
                            <ChevronLeft />
                        </button>
                    </Ripple>

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

                {parentTreeNode?.title && <div className="border-b border-outline" />}

                {/* title */}
                <h1 className="relative">
                    {!editing && parentTreeNode && parentTreeNode.title}

                    {editing && parentTreeNode &&
                        <input
                            value={parentTreeNode.title ?? ''}
                            onChange={(e) => setParentTreeNode({ ...parentTreeNode, title: e.target.value.trim() })}
                            className="w-full rounded p-2 border border-outline bg-surface-variant text-on-surface-variant"
                        />
                    }
                </h1>

                {treeNodes.length !== 0 && <div className="border-b border-outline" />}

                {/* Tree nodes */}
                <div className="flex flex-col gap-2 size-full items-start p-2">
                    {
                        treeNodes.map((r: any, i: number) => {
                            return (
                                <div key={i} className="w-full rounded-lg border border-outline relative">
                                    {/* Delete button */}
                                    {
                                        editing &&
                                        <div className="absolute top-0 right-0">
                                            <Ripple className="rounded-full bg-error text-on-error">
                                                <button onClick={async () => { if (await removeTreeNode(r._id)) setTreeNodes(treeNodes.filter(f => f._id !== r._id)); }}>
                                                    <Trash2 />
                                                </button>
                                            </Ripple>
                                        </div>
                                    }

                                    {/* Title */}
                                    <div className="w-full" onClick={async () => {
                                        let treeNodes = await getTreeNodes(r.treeNodeIds)
                                        if (treeNodes === false)
                                            return

                                        let leafs = await getLeafs(r.leafIds)
                                        if (leafs === false)
                                            return

                                        setTreeNodes(treeNodes)
                                        setParentTreeNode(r)
                                        setLeafs(leafs)
                                        setLocationQueue([...locationQueue, r._id])
                                    }}>
                                        {r.title}
                                    </div>

                                    {i !== treeNodes.length - 1 && <div className="border-b border-outline w-full" />}
                                </div>
                            )
                        })
                    }
                </div>

                {leafs.length !== 0 && <div className="border-b border-outline" />}

                {/* Leafs */}
                <div className="flex flex-col gap-2 size-full items-start p-2">
                    {
                        leafs.map((r: any, i: number) => {
                            return (
                                <div key={i} className="w-full">
                                    <div className="w-full" onClick={() => setShowingLeaf(i)}>
                                        {r.title}
                                    </div>
                                    {i !== leafs.length - 1 && <div className="border-b border-outline w-full" />}
                                </div>
                            )
                        })
                    }
                </div>

                {/* Save button */}
                {
                    editing &&
                    {
                        ...[
                            <div className="border-b border-outline" />,
                            <Ripple className="w-full">
                                <button className="w-full border border-outline rounded bg-primary text-on-primary" onClick={save}>
                                    Save
                                </button>
                            </Ripple>
                        ]
                    }
                }

                {/* Add buttons */}
                {
                    editing &&
                    <div className="absolute bottom-0 right-0 flex flex-row items-center gap-2">
                        {/* Add tree node button */}
                        <Ripple className="rounded-full bg-success text-on-success">
                            <button onClick={async () => setShowAddTreeNodeModal(true)}>
                                <FolderPlus />
                            </button>
                        </Ripple>

                        {/* Add leaf button */}
                        {locationQueue[locationQueue.length - 1] !== 'root' &&
                            <Ripple className="rounded-full bg-success text-on-success">
                                <button onClick={async () => setShowAddLeafModal(true)}>
                                    <Plus />
                                </button>
                            </Ripple>
                        }
                    </div>
                }

                {/* Create Leaf */}
                <Slide open={showAddLeafModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <div className="flex flex-col gap2 p-2">

                        <Ripple className="rounded-full">
                            <button onClick={() => { setNewLeafTitle(''); setShowAddLeafModal(false) }}>
                                <X />
                            </button>
                        </Ripple>

                        <input
                            value={newLeafTitle}
                            onChange={(e) => setNewLeafTitle(e.target.value)}
                            className="w-full rounded border border-outline bg-surface-variant text-on-surface-variant"
                        />

                        <Ripple className="rounded-full w-full bg-success text-on-success">
                            <button onClick={async () => {
                                if (locationQueue[locationQueue.length - 1] === 'root')
                                    return

                                const id = await createLeaf(locationQueue[locationQueue.length - 1], newLeafTitle)
                                if (id === false)
                                    return

                                const leaf = await getLeafs([id])
                                if (leaf === false || !leaf)
                                    return

                                setLeafs([...leafs, leaf])

                                setNewLeafTitle('')
                                setShowAddLeafModal(false)
                            }}>
                                <Plus /> Add
                            </button>
                        </Ripple>

                    </div>
                </Slide>

                {/* Add tree node */}
                <Slide open={showAddTreeNodeModal} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <div className="flex flex-col gap2 p-2">

                        <Ripple className="rounded-full">
                            <button onClick={() => { setNewTreeNodeTitle(''); setShowAddTreeNodeModal(false) }}>
                                <X />
                            </button>
                        </Ripple>

                        <input
                            value={newTreeNodeTitle}
                            onChange={(e) => setNewTreeNodeTitle(e.target.value)}
                            className="w-full rounded border border-outline bg-surface-variant text-on-surface-variant"
                        />

                        <Ripple className="rounded-full w-full bg-success text-on-success">
                            <button onClick={async () => {
                                setTreeNodes([...treeNodes, { _id: treeNodes.length + 'toBeCreated', leafIds: [], root: locationQueue[locationQueue.length - 1] === 'root', title: newTreeNodeTitle, treeNodeIds: [] }])

                                setNewTreeNodeTitle('')
                                setShowAddTreeNodeModal(false)
                            }}>
                                <Plus /> Add
                            </button>
                        </Ripple>

                    </div>
                </Slide>

                {/* Leaf manager */}
                <Slide open={showingLeaf !== undefined} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                    <LeafManager
                        leaf={leafs[showingLeaf!]}
                        onClose={() => setShowingLeaf(undefined)}
                        onLeafChange={l => { leafs[showingLeaf!] = l; setLeafs(leafs) }}
                        onRemove={() => setLeafs([...leafs.filter((_, i) => i !== showingLeaf)])}
                    />
                </Slide>
            </div>
    )
}
