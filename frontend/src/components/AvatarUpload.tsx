import { useState } from "react";
import { useNotification } from "../contexts/NotificationContext";
import { useAuth } from "../contexts/AuthContext";
import { Ripple } from "./Ripple";
import { X } from "../assets/icons/X";

export function AvatarUpload({ artistId, artistName, onClose }: { artistId: string, artistName: string, onClose?: () => void }) {
    const { jsonAuthFetch } = useAuth();

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    const { notify } = useNotification()

    const uploadAvatar = async () => {
        if (!artistName || !avatarFile)
            return

        try {
            let result = await jsonAuthFetch(`/api/artist/avatar?artistId=${artistId}&artistName=${artistName}&type=avatar&fileName=${encodeURIComponent(avatarFile.name)}`, { method: 'POST', body: avatarFile, headers: { 'Content-Type': avatarFile.type } })
            if (result === false || !result.ok)
                return notify('failed to upload audio file', 3000, 'error')
            else
                notify('audio file uploaded', 3000, result.ok ? 'success' : 'error')
        } catch (error) {
            console.error(error);
            notify('failed to upload audio file', 3000, 'error')
        }
    }

    const uploadBanner = async () => {
        if (!artistName || !bannerFile)
            return

        try {
            let result = await jsonAuthFetch(`/api/artist/avatar?artistId=${artistId}&artistName=${artistName}&type=banner&fileName=${encodeURIComponent(bannerFile.name)}`, { method: 'POST', body: bannerFile, headers: { 'Content-Type': bannerFile.type } })
            if (result === false || !result.ok)
                return notify('failed to upload audio file', 3000, 'error')
            else
                notify('audio file uploaded', 3000, result.ok ? 'success' : 'error')
        } catch (error) {
            console.error(error);
            notify('failed to upload audio file', 3000, 'error')
        }
    }

    console.log({ avatarFile, bannerFile })

    return (
        <div className="flex flex-col gap-2 *:w-full size-full rounded-t-2xl p-4 items-center overflow-auto">
            <div className="flex flex-row items-center justify-end" onClick={() => onClose?.()}>
                <Ripple>
                    <X />
                </Ripple>
            </div>

            <input type="file" className="hidden" accept="image/*" onChange={(event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
                console.log('avatar');

                if (!event.target.files) {
                    console.log("event?.target?.result is null or undefined!!!")
                    return
                }
                if (event.target.files.length > 0)
                    setAvatarFile(event.target.files[0]);
            }} id="avatar-upload" />
            <div>
                <Ripple>
                    <label
                        htmlFor="avatar-upload"
                        className="w-full"
                    >
                        <div className="cursor-pointer border border-outline rounded p-2">
                            Browse for avatar file
                        </div>
                    </label>
                </Ripple>
            </div>
            <h1>{avatarFile?.name}</h1>
            <div>
                <Ripple>
                    <button disabled={!avatarFile} className="border border-outline rounded p-2" onClick={uploadAvatar}>
                        Upload
                    </button>
                </Ripple>
            </div>

            <div className="border-b border-outline w-full"></div>

            <input type="file" className="hidden" accept="image/*" onChange={(event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
                console.log('banner');

                if (!event.target.files) {
                    console.log("event?.target?.result is null or undefined!!!")
                    return
                }
                if (event.target.files.length > 0)
                    setBannerFile(event.target.files[0]);
            }} id="banner-upload" />
            <div>
                <Ripple>
                    <label
                        htmlFor="banner-upload"
                        className="w-full"
                    >
                        <div className="cursor-pointer border border-outline rounded p-2">
                            Browse for banner file
                        </div>
                    </label>
                </Ripple>
            </div>
            <h1>{bannerFile?.name}</h1>
            <div>
                <Ripple>
                    <button disabled={!bannerFile} className="border border-outline rounded p-2" onClick={uploadBanner}>
                        Upload
                    </button>
                </Ripple>
            </div>
        </div>
    )
}
