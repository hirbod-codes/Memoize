import { useContext, useEffect, useState } from "react";
import { X } from "../assets/icons/X";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import { Ripple } from "./Ripple";
import { SquareMinus } from "../assets/icons/SquareMinus";
import { AudioContext } from "../contexts/AudioContext";

export function ChoosePlaylist({ audioToAdd, onClose }: { audioToAdd: { audioId: string, title: string, trackNumber: number }, onClose: () => void }) {
    const { audioIds, setAudioIds } = useContext(AudioContext)
    const { jsonAuthFetch } = useAuth();
    const { notify } = useNotification()

    const [userData, setUserData] = useState<any | undefined>(undefined)
    const [newPlaylistName, setNewPlaylistName] = useState<string>('')

    const addNewPlaylist = async () => {
        if (!newPlaylistName)
            return

        try {
            let r = await jsonAuthFetch('/api/user/add-playlist', { method: 'POST', body: JSON.stringify({ name: newPlaylistName, audios: [audioToAdd] }) })
            if (r === false || !r.ok)
                return notify('failed to add to a new playlist', 3000, 'error')
            else
                notify('successful', 3000, 'success')

            onClose?.()
        } catch (err) {
            console.error(err);
            notify('failed to add to a new playlist', 3000, 'error')
        }
    }

    const deletePlaylist = async (name: string) => {
        try {
            let r = await jsonAuthFetch('/api/user/playlist', { method: 'DELETE', body: JSON.stringify({ name }) })
            if (r === false || !r.ok)
                return notify('failed to add to a new playlist', 3000, 'error')
            else
                notify('successful', 3000, 'success')

            onClose?.()
        } catch (err) {
            console.error(err);
            notify('failed to add to a new playlist', 3000, 'error')
        }
    }

    const addToPlaylist = async (name: string) => {
        try {
            let r = await jsonAuthFetch('/api/user/add-to-playlist', { method: 'POST', body: JSON.stringify({ playlistName: name, audio: audioToAdd }) })
            if (r === false || !r.ok)
                return notify('failed to add to playlist', 3000, 'error')
            else
                notify('successful', 3000, 'success')

            onClose?.()
        } catch (err) {
            console.error(err);
            notify('failed to add to playlist', 3000, 'error')
        }
    }

    const addToQueue = () => {
        if (audioIds.find(f => f === audioToAdd.audioId) === undefined)
            setAudioIds([...audioIds, audioToAdd.audioId]);
        notify('added', 2000, 'success')
        onClose?.()
    }

    const run = async () => {
        try {
            let r = await jsonAuthFetch('/api/user/info')
            if (r === false || !r.ok)
                return notify('failed to get user data', 3000, 'error')

            let userData = await r.json()

            setUserData(userData)
        } catch (err) {
            console.error(err);
            notify('failed to get user data', 3000, 'error')
        }
    }

    useEffect(() => {
        run()
    }, [])

    return (
        <div className="flex flex-col gap-2 bg-surface-variant size-full rounded-2xl shadow-2xl overflow-auto relative p-3">
            <div className="py-1 flex flex-row items-center w-full">
                <div className="grow" />

                <div className="text-on-surface" onClick={onClose}>
                    <X />
                </div>
            </div>

            <input
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="bg-surface rounded p-1 w-full shadow-2xl"
            />
            <Ripple>
                <button disabled={!newPlaylistName} className="border border-outline rounded w-full" onClick={addNewPlaylist}>
                    Create a playlist
                </button>
            </Ripple>

            <div className="border-b border-outline" />

            <Ripple>
                <button className="border border-outline rounded w-full" onClick={addToQueue}>
                    Or add to current queue
                </button>
            </Ripple>

            <div className="border-b border-outline" />

            {userData?.playlists && userData.playlists.length > 0 &&
                <>
                    <h1>Or choose a playlist: </h1>

                    <div className="flex flex-col w-full">
                        {
                            userData.playlists.map((p: any, i: number) => {
                                return (
                                    <div key={i}>
                                        <Ripple>
                                            <div className="border w-full rounded-2xl flex flex-row items-center *:p-3">
                                                <div className="grow" onClick={() => addToPlaylist(p.name)}>
                                                    <div>
                                                        {p.name}
                                                    </div>
                                                </div>

                                                <button onClick={() => deletePlaylist(p.name)}>
                                                    <SquareMinus className="text-error" />
                                                </button>
                                            </div>
                                        </Ripple>
                                        {i < userData?.playlists.length - 1 &&
                                            <div className="my-2" />
                                        }
                                    </div>
                                );
                            }
                            )
                        }
                    </div>
                </>
            }
        </div>
    )
}
