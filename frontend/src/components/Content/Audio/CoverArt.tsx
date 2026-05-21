import { useState, useEffect } from "react";
import { cn } from "../../../lib/utils";
import { useNotification } from "../../../contexts/NotificationContext";
import { useAuth } from "../../../contexts/AuthContext";

export function CoverArt({ audioId, onLoaded, className, coverArtRef }: { audioId: string, onLoaded: () => void, className?: string, coverArtRef: React.Ref<HTMLImageElement> }) {
    const { jsonAuthFetch } = useAuth();

    const [coverArt, setCoverArt] = useState<string | null>(null);

    const { notify } = useNotification()

    useEffect(() => {
        if (audioId)
            jsonAuthFetch(`/api/audio/coverArt/${audioId}`)
                .then(async (r) => {
                    if (r === false)
                        notify('failed to download cover art', 3000, 'error')
                    else {
                        const imageUrl = URL.createObjectURL(await r.blob());

                        setCoverArt(imageUrl);
                    }
                })
                .catch((err) => {
                    console.error(err);
                    notify('failed to download cover art', 3000, 'error')
                })

    }, [audioId]);

    return (
        <img src={coverArt || '/default_cover_art.png'} alt="Cover Art" onLoad={() => onLoaded?.()} className={cn("size-full object-cover rounded-lg", className)} ref={coverArtRef} />
    );
}