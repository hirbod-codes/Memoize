import { cn } from "../../lib/utils";

export function Heading2({ strokeLinejoin = 'round', strokeLinecap = 'round', strokeWidth = 1.5, fill = 'none', className }: { strokeLinecap?: "round" | "butt" | "square" | "inherit" | undefined, strokeLinejoin?: "round" | "inherit" | "miter" | "bevel" | undefined, strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} className={cn("size-6", className)}>
            <path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
        </svg>
    )
}
