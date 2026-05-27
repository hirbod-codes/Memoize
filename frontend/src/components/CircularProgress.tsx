import clsx from "clsx";

type CircularProgressProps = {
    size?: number;
    strokeWidth?: number;
    className?: string;
};

export function CircularProgress({ size = 48, strokeWidth = 4, className, }: CircularProgressProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className={clsx("inline-flex items-center justify-center text-primary", className)} style={{ width: size, height: size, }}>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="m3-spinner">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" className="m3-spinner-circle"
                    style={{
                        strokeDasharray: circumference,
                    }}
                />
            </svg>

            <style>
                {`
                .m3-spinner {
                    animation: m3-rotate 2s linear infinite;
                }

                .m3-spinner-circle {
                    animation: m3-dash 1.5s ease-in-out infinite;
                    transform-origin: center;
                }

                @keyframes m3-rotate {
                    100% {
                        transform: rotate(360deg);
                    }
                }

                @keyframes m3-dash {
                    0% {
                        stroke-dasharray: 0, 300;
                        stroke-dashoffset: 0;
                    }

                    50% {
                        stroke-dasharray: 120, 300;
                        stroke-dashoffset: -40;
                    }

                    100% {
                        stroke-dasharray: 120, 300;
                        stroke-dashoffset: -180;
                    }
                }
            `}
            </style>
        </div>
    );
}