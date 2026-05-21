export default function ProgressBar({ progress, dominantColor, transitionRef, onPointerDown, onPointerMove, onPointerUp }: { progress: number, dominantColor?: string | number, transitionRef?: React.RefObject<boolean>, onPointerDown?: React.PointerEventHandler<HTMLDivElement>, onPointerMove?: React.PointerEventHandler<HTMLDivElement>, onPointerUp?: React.PointerEventHandler<HTMLDivElement> }) {

    return (
        <div
            className="select-none touch-none w-full h-0.5 bg-on-surface rounded-sm cursor-pointer"
            style={{ boxShadow: 'inset 0 0 5px -1px #000' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <div
                className="h-0.5 rounded-sm transition-all duration-300"
                style={{
                    width: `${progress}%`,
                    background: dominantColor,
                    transition: transitionRef?.current ? 'none' : 'width 0.3s ease, left 0.3s ease'
                }}
            />

            <div
                className="relative border top-1/2 -translate-y-1/2 size-3 bg-on-surface-variant rounded-full transition-all duration-300"
                style={{
                    left: `calc(max(0px, ${progress}% - 12px))`,
                    transition: transitionRef?.current ? 'none' : 'width 0.3s ease, left 0.3s ease',
                    boxShadow: '0 0 5px -1px #000',
                }}
            />
        </div>
    );
}