import { cn } from "../../lib/utils";

export function Music({ strokeLinejoin = 'round', strokeLinecap = 'round', strokeWidth = 1.5, fill = 'none', className }: { strokeLinecap?: "round" | "butt" | "square" | "inherit" | undefined, strokeLinejoin?: "round" | "inherit" | "miter" | "bevel" | undefined, strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} className={cn("size-6", className)}>
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
        </svg>
    )
}
