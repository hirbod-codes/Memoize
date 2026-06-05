import { useEffect, useRef, useState } from "react"
import { useAuth } from "../contexts/AuthContext"
import { useNotification } from "../contexts/NotificationContext"
import { ChevronLeft } from "../assets/icons/ChevronLeft"
import { Slide } from "./Slide"
import { LeafManager, type Leaf } from "./LeafManager"
import { SquarePen } from "../assets/icons/SquarePen"
import { Eye } from "../assets/icons/Eye"
import { Plus } from "../assets/icons/Plus"
import { X } from "../assets/icons/X"
import { FolderPlus } from "../assets/icons/FolderPlus"
import { Button } from "./Button"
import { SquareMinus } from "../assets/icons/SquareMinus"
import { Search } from "../assets/icons/Search"
import { CircularProgress } from "./CircularProgress"

export type TreeNode = {
    _id?: string
    userId?: string
    parentId: string
    title: string
}

const LIMIT = 10

export function Nodes() {
    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [editing, setEditing] = useState<boolean>(false)

    const [locationQueue, setLocationQueue] = useState<string[]>(['root'])

    const [filter, setFilter] = useState<'folder' | 'file'>('folder')

    const [treeNodes, setTreeNodes] = useState<TreeNode[]>([])
    const [parentTreeNode, setParentTreeNode] = useState<TreeNode>()
    const [leafs, setLeafs] = useState<Leaf[]>([])

    const [showingLeaf, setShowingLeaf] = useState<number | undefined>(undefined)

    const [showAddTreeNodeModal, setShowAddTreeNodeModal] = useState<boolean>(false)
    const [newTreeNodeTitle, setNewTreeNodeTitle] = useState<string>('')

    const [newLeafTitle, setNewLeafTitle] = useState<string>('')
    const [newParentTitle, setNewParentTitle] = useState<string>(parentTreeNode?.title ?? '')

    const [showAddLeafModal, setShowAddLeafModal] = useState<boolean>(false)

    const [waitingFor, setWaitingFor] = useState<string[]>([])
    const addWaiting = (str: string) => {
        setWaitingFor((prev) => [...prev, str])
    }
    const removeWaiting = (str: string) => {
        setWaitingFor((prev) => {
            prev = prev.filter(f => f !== str)
            return [...prev]
        })
    }

    const createTreeNode = async () => {
        try {
            const body: any = { treeNode: { title: newTreeNodeTitle } }
            if (locationQueue[locationQueue.length - 1] !== 'root')
                body.treeNode.parentId = locationQueue[locationQueue.length - 1]

            addWaiting('create-treeNode')
            const r = await jsonAuthFetch(`/api/treeNode`, { method: 'POST', body: JSON.stringify(body) })
            removeWaiting('create-treeNode')
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
            removeWaiting('create-treeNode')
            console.error(error);
            notify('Failed to create folder', 3000, 'error')
            return false
        }
    }

    const getPaginated = async (isRoot: boolean) => {
        try {
            let docs: any[]
            const lastId = !isRoot ? skip.current : undefined
            const parentId = !isRoot && parentTreeNode?._id ? parentTreeNode._id : undefined

            addWaiting(`fetch-${filter === 'folder' ? 'treeNode' : 'leaf'}`)
            const r = await jsonAuthFetch(`/api/${!parentTreeNode || filter === 'folder' ? 'treeNode' : 'leaf'}/list/?limit=${LIMIT}${lastId ? `&lastId=${lastId}` : ``}${!search || search === '' ? '' : '&search=' + search}${parentId ? `&parentId=${parentId}` : ''}`)
            removeWaiting(`fetch-${filter === 'folder' ? 'treeNode' : 'leaf'}`)
            if (r === false || !r.headers.get('content-type')?.includes('application/json')) {
                notify(`failed to search for ${filter}`, 3000, 'error')
                setHasMore(false)
                return false
            }

            docs = await r.json()
            console.log({ docs });

            if (docs.length < 10)
                setHasMore(false)
            else
                setHasMore(true)

            if (docs.length > 0)
                skip.current = docs.length + (skip.current ?? 0)

            if (!parentTreeNode || filter === 'folder')
                setTreeNodes(_prev => {
                    const map = new Map()

                    for (const item of [...docs])
                        map.set(item._id, item)

                    return [...map.values()]
                })
            else
                setLeafs(_prev => {
                    const map = new Map()

                    for (const item of [...docs])
                        map.set(item._id, item)

                    return [...map.values()]
                })
        } catch (err) {
            removeWaiting(`fetch-${filter === 'folder' ? 'treeNode' : 'leaf'}`)
            console.error(err);
            notify(`failed to search for ${filter}`, 3000, 'error')
        }
    }

    const getTreeNodeById = async (ids: string[]) => {
        try {
            addWaiting('fetch-treeNode')
            const r = await jsonAuthFetch(`/api/treeNode/?ids=${ids.join(',')}`)
            removeWaiting('fetch-treeNode')
            if (r === false || !r.headers.get('content-type')?.includes('application/json')) {
                notify(`failed to search for ${filter}`, 3000, 'error')
                return false
            }

            const data = await r.json()
            console.log({ data });

            return data
        } catch (err) {
            removeWaiting('fetch-treeNode')
            console.error(err);
            notify(`failed to search for ${filter}`, 3000, 'error')
        }
    }

    const updateTreeNode = async (treeNode: TreeNode) => {
        try {
            addWaiting('update-treeNode')
            let r = await jsonAuthFetch(`/api/treeNode`, { method: 'PATCH', body: JSON.stringify({ treeNode }) })
            removeWaiting('update-treeNode')
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
            removeWaiting('update-treeNode')
            console.error(error);
            notify('Failed to update folder', 3000, 'error')
            return false
        }
    }

    const removeTreeNode = async (id: string) => {
        try {
            if (!id)
                return

            addWaiting(`remove-folder-${id}`)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeId=${id}`, { method: 'DELETE' })
            removeWaiting(`remove-folder-${id}`)
            if (r === false || !r.ok)
                return notify('failed to load folders', 3000, 'error')

            return true
        } catch (error) {
            removeWaiting(`remove-folder-${id}`)
            console.error(error);
            notify('failed to load folders', 3000, 'error')
            return false
        }
    }

    const createLeaf = async (treeNodeId: string, title: string): Promise<string | false> => {
        try {
            addWaiting('create-leaf')
            let r = await jsonAuthFetch(`/api/leaf`, { method: 'POST', body: JSON.stringify({ leaf: { treeNodeId, title, termContents: [], definitionContents: [] } }) })
            removeWaiting('create-leaf')
            if (r === false || !r.ok) {
                notify('Failed to create new card', 3000, 'error')
                return false
            }
            notify('Successfully created new card', 3000, 'success')

            let data = await r.json()
            console.log(data);

            return data.id
        } catch (error) {
            removeWaiting('create-leaf')
            console.error(error);
            notify('Failed to create new card', 3000, 'error')
            return false
        }
    }

    const removeLeaf = async (id: string) => {
        try {
            if (!id)
                return false

            addWaiting(`leaf-remove-${id}`)
            let r = await jsonAuthFetch(`/api/leaf/?id=${id}`, { method: 'DELETE' })
            removeWaiting(`leaf-remove-${id}`)
            if (r === false || !r.ok) {
                notify('Removing card failed', 3000, 'error')
                return false
            }

            return true
        } catch (error) {
            removeWaiting(`leaf-remove-${id}`)
            console.error(error);
            notify('Removing card failed', 3000, 'error')
            return false
        }
    }

    // Match title
    useEffect(() => {
        if (parentTreeNode)
            setNewParentTitle(parentTreeNode.title)
    }, [parentTreeNode])

    // Location
    useEffect(() => {
        let lastLocationId: string | undefined = locationQueue[locationQueue.length - 1]

        if (lastLocationId === 'root') {
            setParentTreeNode(undefined)
            return
        }

        addWaiting('fetch-parentTreeNode')
        getTreeNodeById([lastLocationId])
            .then(v => {
                removeWaiting('fetch-parentTreeNode')
                if (v === false || v.length < 1)
                    return

                setParentTreeNode(v[0])
            })
            .catch(e => { console.error(e); removeWaiting('fetch-parentTreeNode'); })
    }, [locationQueue])
    useEffect(() => {
        skip.current = null
        if (!parentTreeNode)
            getPaginated(true)
        else if (parentTreeNode)
            getPaginated(false)
    }, [parentTreeNode])

    const isFetching = waitingFor.includes('fetch-treeNode') || waitingFor.includes('fetch-leaf')

    // Pagination
    const [search, setSearch] = useState('')
    const [hasMore, setHasMore] = useState(true)
    const skip = useRef<number | null>(null)
    const loaderRef = useRef<HTMLDivElement | null>(null);
    const noSearch = useRef(false)
    useEffect(() => {
        skip.current = null
        getPaginated(false)
    }, [filter])
    useEffect(() => {
        if (noSearch.current)
            noSearch.current = false
        else if (search || search === '') {
            const t = setTimeout(() => {
                setTreeNodes([])
                setLeafs([])
                skip.current = null
                setHasMore(true)
                getPaginated(search === '' && !parentTreeNode ? true : false)
            }, 500)

            return () => clearTimeout(t)
        }
    }, [search])
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const first = entries[0];

                if (first.isIntersecting && hasMore && !isFetching)
                    getPaginated(false)
            },
            {
                rootMargin: "200px",
            }
        );

        const current = loaderRef.current;

        if (current) {
            observer.observe(current);
        }

        return () => {
            if (current) observer.unobserve(current);
        };
    }, [hasMore, isFetching]);

    console.log({ locationQueue, treeNodes, leafs, parentTreeNode, showingLeaf, newParentTitle, newLeafTitle })

    return (
        <div className="size-full relative p-4">
            <div className="size-full flex flex-col gap-2 items-center">

                {/* Search */}
                <div className="w-full flex flex-row items-center gap-2 bg-surface-container text-on-surface px-2 py-1 rounded-lg">
                    <Button isIcon variant="text" color="primary">
                        {
                            isFetching
                                ? <CircularProgress size={20} strokeWidth={1.5} />
                                : <Search />
                        }
                    </Button>

                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="grow bg-transparent py-2"
                    />
                </div>

                <div className="size-full flex flex-col gap-2 p-2 overflow-y-auto bg-surface-container rounded-lg">
                    {/* Buttons */}
                    <div className="w-full flex flex-row items-center justify-between">
                        {/* Go back button */}
                        {
                            locationQueue.length > 1 &&
                            <Button variant="text" color="on-surface" isIcon disabled={locationQueue.length <= 1 || waitingFor.includes('fetch-treeNode') || waitingFor.includes('fetch-parentTreeNode')} onPointerDown={async () => {
                                noSearch.current = true
                                setSearch('')
                                setLeafs([])
                                setLocationQueue(prev => { prev.pop(); return [...prev]; })
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

                        {
                            locationQueue[locationQueue.length - 1] !== 'root' && waitingFor.includes('fetch-parentTreeNode') &&
                            <div className="flex flex-col items-center justify-center w-full">
                                <CircularProgress size={30} strokeWidth={2} />
                            </div>
                        }

                        {editing && parentTreeNode &&
                            <div className="flex flex-row items-center gap-2">
                                <input
                                    value={newParentTitle}
                                    onChange={(e) => setNewParentTitle(e.target.value)}
                                    className="grow rounded-md p-2 border border-outline bg-surface-variant text-on-surface-variant"
                                />

                                <Button variant="outlined" color="on-surface" className="rounded-md" disabled={waitingFor.includes('fetch-treeNode')} onPointerDown={async () => {
                                    const result = await updateTreeNode({ ...parentTreeNode, title: newParentTitle })
                                    if (result === false)
                                        return

                                    setParentTreeNode({ ...parentTreeNode, title: newParentTitle })
                                }}>
                                    {
                                        waitingFor.includes('fetch-treeNode')
                                            ? <CircularProgress size={20} strokeWidth={1} />
                                            : 'Save'
                                    }
                                </Button>
                            </div>
                        }
                    </h1>

                    {parentTreeNode?.title && <div className="border-b border-outline-variant w-full" />}

                    {/* Tabs */}
                    {
                        locationQueue[locationQueue.length - 1] !== 'root' &&
                        <div className="w-full flex flex-row items-start *:border-b-4 border-b border-outline-variant">
                            <Button variant='text' color={filter === 'folder' ? 'secondary' : "on-surface"} className={`rounded-none ${filter === 'folder' ? 'border-secondary' : 'border-outline'}`} onPointerDown={() => setFilter('folder')}>
                                Folder
                            </Button>
                            <Button variant='text' color={filter === 'file' ? 'secondary' : "on-surface"} className={`rounded-none ${filter === 'file' ? 'border-secondary' : 'border-outline'}`} onPointerDown={() => setFilter('file')}>
                                File
                            </Button>
                        </div>
                    }

                    {
                        waitingFor.includes('fetch-treeNode') &&
                        <div className="flex flex-col items-center justify-center size-full">
                            <CircularProgress size={60} />
                        </div>
                    }

                    {/* Tree nodes */}
                    {
                        !waitingFor.includes('fetch-treeNode') && (!parentTreeNode || filter === 'folder') && treeNodes && treeNodes.map((r: any, i: number) => {
                            return (
                                <div
                                    key={i}
                                    className="flex flex-row items-center justify-between w-full rounded-lg bg-surface-container-low hover:bg-surface-container-highest text-on-surface"
                                >
                                    {/* Title */}
                                    <div
                                        className="w-full grow p-2"
                                        onPointerDown={async () => {
                                            setLeafs([])
                                            setLocationQueue([...locationQueue, r._id])
                                        }}
                                    >
                                        {r.title}
                                    </div>

                                    {/* Delete button */}
                                    {
                                        editing &&
                                        <Button variant="text" color='error' isIcon disabled={waitingFor.includes(`remove-folder-${r._id}`)} onPointerDown={async () => { if (await removeTreeNode(r._id)) setTreeNodes(treeNodes.filter(f => f._id !== r._id)); }}>
                                            {
                                                waitingFor.includes(`remove-folder-${r._id}`)
                                                    ? <CircularProgress size={20} strokeWidth={1} className="text-error" />
                                                    : <SquareMinus />
                                            }
                                        </Button>
                                    }
                                </div>
                            )
                        })
                    }

                    {
                        waitingFor.includes('fetch-leaf') &&
                        <div className="flex flex-col items-center justify-center size-full">
                            <CircularProgress size={60} />
                        </div>
                    }

                    {/* Leafs */}
                    {
                        !waitingFor.includes('fetch-treeNode') && filter === 'file' && leafs && leafs.map((r: any, i: number) => {
                            return (
                                <div key={i} className="flex flex-row items-center justify-between w-full rounded-lg p-2 bg-surface-container-low hover:bg-surface-container-highest text-on-surface" onPointerDown={() => setShowingLeaf(i)}>
                                    <div className="w-full grow">
                                        {r.title}
                                    </div>

                                    {/* Delete button */}
                                    {
                                        editing &&
                                        <Button variant="text" color='error' isIcon disabled={waitingFor.includes(`leaf-remove-${r._id}`)} onPointerDown={async () => { if (await removeLeaf(r._id)) setLeafs(leafs.filter(f => f._id !== r._id)); }}>
                                            {
                                                waitingFor.includes(`leaf-remove-${r._id}`)
                                                    ? <CircularProgress size={20} strokeWidth={1} className="text-error" />
                                                    : <SquareMinus />
                                            }
                                        </Button>
                                    }
                                </div>
                            )
                        })
                    }

                    <div ref={loaderRef} className="h-10" />

                    {/* Add buttons */}
                    {
                        editing &&
                        <div className="absolute bottom-0 right-0 w-full flex flex-row justify-end gap-2 p-2">
                            {/* Add tree node button */}
                            {
                                filter === 'folder' &&
                                <Button variant='filled' color="success" isIcon onPointerDown={async () => setShowAddTreeNodeModal(true)}>
                                    <FolderPlus />
                                </Button>
                            }

                            {/* Add leaf button */}
                            {
                                filter === 'file' && locationQueue[locationQueue.length - 1] !== 'root' &&
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
                                <Button variant='text' isIcon color="on-surface" onPointerDown={() => { setNewTreeNodeTitle(''); setShowAddTreeNodeModal(false) }}>
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

                            <Button variant="outlined" color='success' className="w-full rounded-lg" disabled={waitingFor.includes('create-treeNode')} onPointerDown={async () => {
                                const result = await createTreeNode()
                                if (result === false)
                                    return

                                setTreeNodes([{ _id: result, parentId: locationQueue[locationQueue.length - 1] !== 'root' ? locationQueue[locationQueue.length - 1] : 'undefined', title: newTreeNodeTitle }, ...treeNodes])

                                setNewTreeNodeTitle('')
                                setShowAddTreeNodeModal(false)
                            }}>
                                {
                                    waitingFor.includes('create-treeNode')
                                        ? <CircularProgress size={20} strokeWidth={1} className="text-success" />
                                        : [<Plus className="inline" key={0} />, <span key={1}>Add</span>]
                                }
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

                            <Button variant="outlined" color='success' className="w-full rounded-lg" disabled={waitingFor.includes('create-leaf')} onPointerDown={async () => {
                                if (locationQueue[locationQueue.length - 1] === 'root')
                                    return

                                const id = await createLeaf(locationQueue[locationQueue.length - 1], newLeafTitle)
                                if (id === false)
                                    return

                                setLeafs([{ _id: id, title: newLeafTitle, definitionContents: [], termContents: [], userId: '' }, ...leafs])

                                setNewLeafTitle('')
                                setShowAddLeafModal(false)
                            }}>
                                {
                                    waitingFor.includes('create-leaf')
                                        ? <CircularProgress size={20} strokeWidth={1} className="text-success" />
                                        : [<Plus className="inline" key={0} />, <span key={1}>Add</span>]
                                }
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
                                onRemove={async () => {
                                    let result = await removeLeaf(leafs[showingLeaf!]._id)
                                    if (result === false)
                                        return

                                    setLeafs(prev => [...prev.filter((_, i) => i !== showingLeaf)])
                                }}
                            />
                        }
                    </Slide>
                </div>
            </div>
        </div>
    )
}
