import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import { useNotification } from "../../contexts/NotificationContext"
import { Ripple } from "../Ripple"
import { ChevronLeft } from "../../assets/icons/ChevronLeft"
import { Slide } from "../Slide"
import { PresentLeaf } from "./PresentLeaf"

export function Nodes() {
    const { jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const [records, setRecords] = useState([])
    const [leafs, setLeafs] = useState([])
    const [fetching, setFetching] = useState(false)
    const [locationQueue, setLocationQueue] = useState<string[]>(['root'])
    const [showingLeaf, setShowingLeaf] = useState<number | undefined>(undefined)

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

    const getTreeNode = async (id: string) => {
        try {
            setFetching(true)
            const r = await jsonAuthFetch(`/api/treeNode/?treeNodeIds=${id}`)
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

    useEffect(() => {
        getRoots()
            .then(d => setRecords(d))
    }, [])

    console.log({ locationQueue, records })

    return (
        <div className="flex flex-col gap-2 size-full items-start p-2">

            <div className="flex flex-row items-start">
                <Ripple className="rounded-full">
                    <button disabled={locationQueue.length > 1} onClick={async () => {
                        let prev: string | undefined = locationQueue[locationQueue.length - 2]

                        if (prev === 'root') {
                            let r = await getRoots()
                            if (r === false)
                                return

                            setRecords(r)
                            setLeafs([])
                            setLocationQueue(['root'])

                            return
                        }

                        let d = await getTreeNode(prev)

                        let r = await getTreeNodes(d.treeNodeIds)
                        if (r === false)
                            return

                        let l = await getLeafs(d.leafIds)
                        if (l === false)
                            return

                        setRecords(r)
                        setLeafs(l)

                        locationQueue.pop()
                        setLocationQueue(locationQueue)
                    }}>
                        <ChevronLeft />
                    </button>
                </Ripple>
            </div>

            <div className="flex flex-col gap-2 size-full items-start p-2">
                {
                    records.map((r: any, i: number) => {
                        return (
                            <div key={i} className="w-full">
                                <div className="w-full" onClick={async () => {
                                    let treeNodes = await getTreeNodes(r.treeNodeIds)
                                    if (treeNodes === false)
                                        return

                                    let leafs = await getLeafs(r.leafIds)
                                    if (leafs === false)
                                        return

                                    setRecords(treeNodes)
                                    setLeafs(leafs)
                                    setLocationQueue([...locationQueue, r._id])
                                }}>
                                    {r.title}
                                </div>
                                {i !== records.length - 1 && <div className="border-b border-outline w-full" />}
                            </div>
                        )
                    })
                }
            </div>

            {records.length !== 0 && <div className="border-b border-outline" />}

            <div className="flex flex-col gap-2 size-full items-start p-2">
                {
                    leafs.map((r: any, i: number) => {
                        return (
                            <div key={i} className="w-full">
                                <div className="w-full" onClick={() => setShowingLeaf(i)}>
                                    {r.title}
                                </div>
                                {i !== records.length - 1 && <div className="border-b border-outline w-full" />}
                            </div>
                        )
                    })
                }
            </div>

            <Slide open={showingLeaf !== undefined} className="pointer-events-auto rounded-t-3xl bg-surface shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                <PresentLeaf leaf={showingLeaf !== undefined ? leafs[showingLeaf] : undefined} />
            </Slide>
        </div>
    )
}

