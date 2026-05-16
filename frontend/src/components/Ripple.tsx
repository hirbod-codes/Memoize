import { useState } from 'react';
import { cn } from '../lib/utils';


export function Ripple({ children, className }: { children: React.ReactNode, className?: string }) {
    const [_ripple, setRipple] = useState(false);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const div = e.currentTarget;
        const rect = div.getBoundingClientRect();
        const size = Math.max(div.offsetWidth, div.offsetHeight);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        const rippleElement = document.createElement('span');
        rippleElement.style.width = rippleElement.style.height = `${size}px`;
        rippleElement.style.left = `${x}px`;
        rippleElement.style.top = `${y}px`;

        rippleElement.classList.add('ripple');

        div.appendChild(rippleElement);

        setTimeout(() => {
            div.removeChild(rippleElement);
        }, 600);

        setRipple(true);
    };

    return (
        <div
            className={cn("relative overflow-hidden cursor-pointer flex flex-col items-center justify-center", className)}
            onPointerDown={handlePointerDown}
        >
            {children}
        </div>
    );
}