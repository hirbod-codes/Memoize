import { cn } from "../../lib/utils";

export function Pause({ strokeWidth = 1.5, fill = 'none', className }: { strokeWidth?: number, fill?: string, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill={fill} viewBox="0 0 24 24" strokeWidth={strokeWidth} stroke="currentColor" className={cn("size-6", className)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
        </svg>
    )
}
