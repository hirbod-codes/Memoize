export function Video({ videoIds }: { videoIds: string[] }) {
    return (
        !videoIds || videoIds.length === 0
            ? 'No images!'
            : <div className="size-full p-2 border overflow-x-auto">
                <div className="size-auto p-2 flex flex-row items-center border">
                    {
                        videoIds.map((m, i) =>
                            <img key={i} src={`/api/video/file/${m}`} crossOrigin="use-credentials" className="w-[4cm] border" />
                        )
                    }
                </div>
            </div>
    )
}
