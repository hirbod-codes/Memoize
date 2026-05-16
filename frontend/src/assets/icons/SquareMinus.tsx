import { cn } from "../../lib/utils";

export function SquareMinus({ strokeLinejoin = 'round', strokeLinecap = 'round', strokeWidth = 1.5, fill = 'none', className }: { strokeLinecap?: "round" | "butt" | "square" | "inherit" | undefined, strokeLinejoin?: "round" | "inherit" | "miter" | "bevel" | undefined, strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} className={cn("size-6", className)}><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 12h8" /></svg>
    )
}
