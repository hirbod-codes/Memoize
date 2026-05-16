import { cn } from "../../lib/utils";

export function Pencil({ strokeLinejoin = 'round', strokeLinecap = 'round', strokeWidth = 1.5, fill = 'none', className }: { strokeLinecap?: "round" | "butt" | "square" | "inherit" | undefined, strokeLinejoin?: "round" | "inherit" | "miter" | "bevel" | undefined, strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} className={cn("size-6", className)}><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></svg>
    )
}
