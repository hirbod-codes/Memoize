import { useContext } from "react";
import { Music } from "../assets/icons/Music";
import { Search } from "../assets/icons/Search";
import { Upload } from "../assets/icons/Upload";
import { AudioContext } from "../contexts/AudioContext";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../contexts/AuthContext";
import { Ripple } from "./Ripple";
import { ListVideo } from "../assets/icons/ListVideo";


export function NavBar({ content, onChange }: { content: string, onChange?: (s: string) => void }) {
    const { open, setOpen } = useContext(AudioContext)
    const { accessToken } = useAuth()

    let payload: any
    if (accessToken) {
        payload = jwtDecode(accessToken);

        console.log({ payload });
    }

    return (
        <div className="text-on-surface-variant bg-surface-variant p-4 shadow-2xl flex flex-row items-center justify-around *:p-1 *:text-on-primary-container">
            <Ripple className="rounded-full">
                <button disabled={open} className={'disabled:text-on-disabled'} onClick={() => setOpen(true)}><Music /></button>
            </Ripple>
            <Ripple className="rounded-full">
                <button disabled={content === 'search'} className={'disabled:text-on-disabled'} onClick={() => onChange?.('search')}><Search /></button>
            </Ripple>
            <Ripple className="rounded-full">
                <button disabled={content === 'playlists'} className={'disabled:text-on-disabled'} onClick={() => onChange?.('playlists')}><ListVideo /></button>
            </Ripple>
            {payload?.username === 'hirbod' &&
                <Ripple className="rounded-full">
                    <button disabled={content === 'upload'} className={'disabled:text-on-disabled'} onClick={() => onChange?.('upload')}><Upload /></button>
                </Ripple>
            }
        </div>
    )
}
