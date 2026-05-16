import { useEffect, useState } from "react";
import { audioManager } from "./AudioManager";

export function useAudio() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        audioManager.subscribe(() => {
            forceUpdate(x => x + 1);
        });
    }, []);

    return audioManager;
}