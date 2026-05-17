export function Image({ imageIds }: { imageIds: string[] }) {
    return (
        !imageIds || imageIds.length === 0
            ? 'No images!'
            : <div className="size-full p-2 border overflow-x-auto">
                <div className="size-auto p-2 flex flex-row items-center border">
                    {
                        imageIds.map((m, i) =>
                            <img key={i} src={`/api/image/file/${m}`} crossOrigin="use-credentials" className="w-[4cm] border" />
                        )
                    }
                </div>
            </div>
    )
}
