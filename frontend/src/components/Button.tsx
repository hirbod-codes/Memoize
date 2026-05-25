import { useLayoutEffect, useState, type ButtonHTMLAttributes, type MouseEvent, type PointerEvent } from "react";
import { cn } from "../lib/utils";

type ButtonVariant = 'filled' | 'elevated' | 'tonal' | 'outlined' | 'text' | 'elevated';
type ColorPalette = 'primary' | 'secondary' | 'tertiary' | 'error' | 'surface' | 'on-surface' | 'success';

interface MaterialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    color?: ColorPalette;
    icon?: React.ReactNode;
    isIcon?: boolean
}

interface RippleData { id: number; x: number; y: number; size: number; }

export function Button({ children, variant = 'filled', color = 'primary', icon, className = '', isIcon = false, disabled, onClick, onPointerDown, ...props }: MaterialButtonProps) {
    const [ripples, setRipples] = useState<RippleData[]>([]);

    // Clean up ripples after their animation finishes (approx 550ms) 
    useLayoutEffect(() => {
        if (ripples.length > 0) {
            const timer = setTimeout(() => { setRipples((prev) => prev.slice(1)); }, 550);

            return () => clearTimeout(timer);
        }
    }, [ripples]);

    const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
        if (disabled)
            return;

        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();

        // Calculate size required to fully cover the button from click point 
        const size = Math.max(rect.width, rect.height) * 2;

        // Coordinates relative to the button 
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        const newRipple: RippleData = { id: Date.now() + Math.random(), x, y, size, };
        setRipples((prev) => [...prev, newRipple]);

        onPointerDown?.(e)
    };

    const handleButtonClick = (e: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
        if (disabled) {
            e.preventDefault();
            return;
        }

        onClick?.(e);
    };

    // Base M3 Layout & Typography 
    const baseStyles = `
        inline-flex items-center justify-center gap-2 
        h-10 px-6 rounded-full 
        text-sm font-medium tracking-wide 
        transition-all duration-200 ease-in-out 
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 
        disabled:bg-on-surface/[0.12] disabled:text-on-surface/[0.38] disabled:shadow-none disabled:pointer-events-none 
        relative overflow-hidden group select-none Isolation-isolate
    `.trim();

    // Dynamic Tailwind mapping based on variant 
    const variantStyles: Record<ButtonVariant, string> = {
        filled: ` bg-${color} text-on-${color} shadow-sm hover:shadow-md focus-visible:ring-${color}`,
        elevated: ` bg-surface-container-low text-${color} shadow-md hover:shadow-lg focus-visible:ring-${color} disabled:bg-on-surface/[0.12]`,
        tonal: ` bg-${color}-container text-on-${color}-container hover:shadow-sm focus-visible:ring-${color}`,
        outlined: ` bg-transparent text-${color} border border-${color} hover:bg-${color}/[0.08] focus-visible:ring-${color} focus-visible:border-${color} disabled:border-on-surface/[0.12] disabled:bg-transparent`,
        text: ` bg-transparent text-${color} px-3 hover:bg-${color}/[0.08] focus-visible:ring-${color} disabled:bg-transparent`,
    };

    const iconPadding = icon && variant !== 'text' ? 'pl-4 pr-6' : '';

    const hasAction = onClick || onPointerDown || props.onMouseDown

    console.log({ ripples });

    return (
        <button
            className={cn(baseStyles, variantStyles[variant], iconPadding, isIcon ? 'rounded-full aspect-square px-0 p-0' : '', hasAction ? 'cursor-pointer' : '', className)}
            disabled={disabled}
            onPointerDown={handlePointerDown}
            onClick={handleButtonClick}
            {...props}
        >
            {/* 1. M3 State Layer (Hover state overlay) */}
            <span className="absolute inset-0 opacity-0 group-hover:bg-current group-hover:opacity-[0.08] transition-opacity duration-100 pointer-events-none z-0" />

            {/* 2. Dynamic Ripple Container */}
            <span className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {
                    ripples.map((ripple) => (
                        <span
                            key={ripple.id}
                            className="absolute bg-current rounded-full animate-ripple opacity-[0.12]"
                            style={{
                                top: ripple.y,
                                left: ripple.x,
                                width: ripple.size,
                                height: ripple.size,
                            }}
                        />
                    ))
                }
            </span>

            {/* 3. Button Content (Kept above state/ripple layers via z-10) */}
            {icon && <span className="w-5 h-5 flex items-center justify-center relative z-10">{icon}</span>}
            <span className="relative z-10">{children}</span>
        </button>
    );
};