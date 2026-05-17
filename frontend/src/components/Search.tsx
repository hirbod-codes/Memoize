import { useContext, useEffect, useRef, useState } from "react"
import { Search as SearchIcon } from "../assets/icons/Search"
import { ArtistCard } from "./cards/ArtistCard"
import { AlbumCard } from "./cards/AlbumCard"
import { AudioCard } from "./cards/AudioCard"
import { useNotification } from "../contexts/NotificationContext"
import { useAuth } from "../contexts/AuthContext"
import { Ripple } from "./Ripple"
import { Plus } from "../assets/icons/Plus"
import { ArtistContext } from "../contexts/ArtistContext"
import { Slide } from "./new/Slide"
import { ChoosePlaylist } from "./ChoosePlaylist"
import { AudioContext } from "../contexts/AudioContext"
import { Trash2 } from "../assets/icons/Trash2"
import { jwtDecode } from "jwt-decode"

export function Search() {
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'artist' | 'album' | 'audio'>('artist')
    const [records, setRecords] = useState<any[]>([])
    const [fetching, setFetching] = useState(false)
    const [hasMore, setHasMore] = useState(true)

    const [deletingAudio, setDeletingAudio] = useState<{ name: string, id: string } | undefined>(undefined)

    const [openChoosePlaylist, setOpenChoosePlaylist] = useState(false)
    const [audioToAdd, setAudioToAdd] = useState<{ audioId: string, title: string, trackNumber: number } | undefined>(undefined)

    const lastIdRef = useRef<string | null>(null)
    const loaderRef = useRef<HTMLDivElement | null>(null);

    const { setOpen: setAudioOpen, setAudioIds } = useContext(AudioContext)
    const { setOpen, setArtistId } = useContext(ArtistContext)
    const { accessToken, jsonAuthFetch } = useAuth()
    const { notify } = useNotification()

    const get = async (reset: boolean) => {
        try {
            let docs: any[]
            const lastId = reset ? undefined : lastIdRef.current

            setFetching(true)
            const r = await jsonAuthFetch(`/api/${filter}/list/?limit=10${lastId ? `&lastId=${lastId}` : ``}${search === '' ? '' : '&search=' + search}`)
            setFetching(false)
            if (r === false || !r.headers.get('content-type')?.includes('application/json')) {
                notify(`failed to search for ${filter}`, 3000, 'error')
                setHasMore(false)
            } else {
                docs = await r.json()

                if (docs.length < 10) {
                    setHasMore(false)
                } else {
                    setHasMore(true)
                }

                if (docs.length > 0)
                    lastIdRef.current = docs[docs.length - 1]._id

                setRecords(prev => {
                    const map = new Map()

                    for (const item of [...prev, ...docs])
                        map.set(item._id, item)

                    return [...map.values()]
                })
            }
        } catch (err) {
            setFetching(false)
            console.error(err);
            notify(`failed to search for ${filter}`, 3000, 'error')
        }
    }

    useEffect(() => {
        setRecords([])
        lastIdRef.current = null
        setHasMore(true)
        get(true)
    }, [filter])

    useEffect(() => {
        if (search) {
            const t = setTimeout(() => {
                setRecords([])
                lastIdRef.current = null
                setHasMore(true)
                get(true)
            }, 500)

            return () => clearTimeout(t)
        }
    }, [search])

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                const first = entries[0];

                if (first.isIntersecting && hasMore && !fetching)
                    get(false)
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
    }, [hasMore, fetching]);

    let payload: any
    if (accessToken)
        payload = jwtDecode(accessToken);

    const isAdmin = payload?.username === 'hirbod'

    const deleteAudio = async () => {
        try {
            console.log({ deletingAudio });

            if (!deletingAudio || !deletingAudio.id)
                return notify('failed to delete file', 3000, 'error')

            const r = await jsonAuthFetch(`/api/audio/${deletingAudio.id}`, { method: 'DELETE' })
            if (r === false || !r.ok)
                return notify('failed to delete file', 3000, 'error')

            setRecords(records.filter(f => f._id !== deletingAudio.id))

            setDeletingAudio(undefined)

            return notify('deleted successfully', 3000, 'success')
        } catch (error) {
            console.error(error);
            return notify('failed to delete file', 3000, 'error')
        }
    }

    return (
        <div className="size-full p-2 flex flex-col gap-1">
            <div className="flex flex-row gap-1 items-center">
                <SearchIcon />

                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-surface-variant text-on-surface-variant p-2 rounded-full w-full border border-outline"
                />
            </div>

            <div className="my-2 w-full flex flex-row gap-3 border-b border-outline-variant *:border-b-4 *:border-outline">
                <button disabled={filter === 'artist'} onClick={() => { setFilter('artist') }} className="disabled:border-primary">
                    Artists
                </button>
                <button disabled={filter === 'album'} onClick={() => { setFilter('album') }} className="disabled:border-primary">
                    Albums
                </button>
                <button disabled={filter === 'audio'} onClick={() => { setFilter('audio') }} className="disabled:border-primary">
                    Musics
                </button>
            </div>

            <div className="overflow-auto w-full grow">
                {
                    records.map((r, i) => {
                        return (
                            <div key={i}>
                                {
                                    filter === 'artist'
                                        ? <ArtistCard artistId={r._id} clicked={() => { setArtistId(r._id); setOpen(true) }} name={r.name} />
                                        : (
                                            filter === 'album'
                                                ? <AlbumCard name={r.name} />
                                                : <AudioCard title={r.title} audioId={r._id} clicked={() => { setAudioIds([r._id]); setAudioOpen(true) }}>
                                                    <div className="flex flex-row items-center gap-1">
                                                        {
                                                            isAdmin &&
                                                            <Ripple>
                                                                <button onClick={() => setDeletingAudio({ name: r.title, id: r._id })}>
                                                                    <Trash2 className="text-error" />
                                                                </button>
                                                            </Ripple>
                                                        }
                                                        <Ripple>
                                                            <button onClick={() => { setAudioToAdd({ audioId: r._id, title: r.title, trackNumber: r.metadata.trackNumber }); setOpenChoosePlaylist(true) }}>
                                                                <Plus className="text-success" />
                                                            </button>
                                                        </Ripple>
                                                    </div>
                                                </AudioCard>
                                        )
                                }
                                {
                                    i < records.length - 1 &&
                                    <div className="border-b border-outline m-4" />
                                }
                            </div>
                        )
                    })
                }

                <div className="pointer-events-none absolute z-50 w-full top-0 left-0 overflow-hidden">
                    <Slide open={deletingAudio !== undefined} className="pointer-events-auto rounded-3xl bg-surface-variant shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                        <div className="flex flex-col w-full items-center gap-3 p-4 text-on-surface">
                            <div className="">
                                Delete {deletingAudio?.name}?
                            </div>

                            <div className="flex flex-row items-center justify-around gap-2 *:grow w-full">
                                <Ripple><button className="w-full border border-error rounded-lg text-error" onClick={deleteAudio}>Yes</button></Ripple>
                                <Ripple><button className="w-full border border-outline rounded-lg text-on-surface" onClick={() => setDeletingAudio(undefined)}>No</button></Ripple>
                            </div>
                        </div>
                    </Slide>
                </div >

                {audioToAdd &&
                    <div className="pointer-events-none absolute z-50 w-full top-0 left-0 overflow-hidden">
                        <Slide open={openChoosePlaylist} className="pointer-events-auto rounded-3xl bg-surface-variant shadow-2xl" style={{ height: 'calc(100% - 0.7cm)', marginTop: '0.7cm' }}>
                            <ChoosePlaylist audioToAdd={audioToAdd} onClose={() => setOpenChoosePlaylist(false)} />
                        </Slide>
                    </div >
                }

                <div ref={loaderRef} className="h-10" />

                {fetching && <p>Loading...</p>}
            </div>
        </div>
    )
}
