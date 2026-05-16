import { jwtDecode } from "jwt-decode";
import { useAuth } from "../contexts/AuthContext";
import { useContext, useEffect, useState } from "react";
import { useNotification } from "../contexts/NotificationContext";
import { Ripple } from "./Ripple";
import { SquareMinus } from "../assets/icons/SquareMinus";
import { AudioContext } from "../contexts/AudioContext";

export function Playlists() {
    const { jsonAuthFetch, accessToken } = useAuth()
    const { notify } = useNotification()
    const { setOpen, setAudioIds } = useContext(AudioContext)

    const [fetching, setFetching] = useState(false)
    const [userData, setUserData] = useState<any | undefined>(undefined)

    let payload: any
    if (accessToken) {
        payload = jwtDecode(accessToken);

        console.log({ payload });
    }

    const deletePlaylist = async (name: string) => {
        try {
            let r = await jsonAuthFetch('/api/user/playlist', { method: 'DELETE', body: JSON.stringify({ name }) })
            if (r === false || !r.ok)
                return notify('failed to add to a new playlist', 3000, 'error')
            else
                notify('successful', 3000, 'success')

            run()
        } catch (err) {
            console.error(err);
            notify('failed to add to a new playlist', 3000, 'error')
        }
    }

    const run = async () => {
        try {
            setFetching(true)
            let r = await jsonAuthFetch('/api/user/info')
            setFetching(false)

            if (r === false || !r.ok)
                return notify('failed to fetch user data', 3000, 'error')

            const data = await r.json()
            setUserData(data)
        } catch (error) {
            console.error(error);
            return notify('failed to fetch user data', 3000, 'error')
        }
    }

    useEffect(() => {
        if (accessToken)
            run()
    }, [])

    return (
        <div className="flex flex-col gap-2 p-4 text-on-surface">
            {
                fetching
                    ? <div className="absolute top-0 left-0 size-full flex flex-col items-center justify-center">
                        <div className="size-20 border-4 border-on-surface border-t-primary rounded-full animate-spin" />
                    </div>
                    : userData && userData.playlists.length && userData.playlists.length > 0
                        ? userData.playlists.map((p: any, i: number) =>
                            <div key={i} className="flex flex-row items-center text-on-surface border-b border-outline">
                                <div className="grow" onClick={() => { setAudioIds(p.audios.map((a: any) => a.audioId)); setOpen(true) }}>
                                    {p.name}
                                </div>

                                <Ripple className="rounded-full p-2">
                                    <button onClick={() => deletePlaylist(p.name)}>
                                        <SquareMinus className="text-error" />
                                    </button>
                                </Ripple>
                            </div>
                        )
                        : <div>No Playlist found!</div>
            }
        </div>
    )
}
