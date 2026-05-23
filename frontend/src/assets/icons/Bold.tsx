import { cn } from "../../lib/utils";

export function Bold({ strokeLinejoin = 'round', strokeLinecap = 'round', strokeWidth = 1.5, fill = 'none', className }: { strokeLinecap?: "round" | "butt" | "square" | "inherit" | undefined, strokeLinejoin?: "round" | "inherit" | "miter" | "bevel" | undefined, strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} className={cn("size-6", className)}><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>
    )
}
