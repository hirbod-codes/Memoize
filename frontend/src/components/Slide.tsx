import { AnimatePresence, motion, type HTMLMotionProps, type MotionStyle } from "framer-motion";
import { cn } from "../lib/utils";
import { useState } from "react";

export function Slide({ open = false, motionProps, children, className, style, position = '0vh' }: { open?: boolean, motionProps?: HTMLMotionProps<"div">, children?: React.ReactNode, className?: string, style?: MotionStyle, position?: string }) {
    const [animationComplete, setAnimationComplete] = useState(false)

    return (
        <AnimatePresence>
            {open &&
                <motion.div
                    initial={{ y: "100vh" }}
                    animate={{ y: position }}
                    exit={{ y: "100vh" }}
                    transition={{
                        duration: 0.7,
                        ease: [0, 1, 0.5, 1],
                    }}
                    {...motionProps}
                    className={cn("absolute size-full top-0 left-0 pointer-events-auto z-10 p-2", className)}
                    style={style}
                    onAnimationComplete={() => setAnimationComplete(true)}
                >
                    {animationComplete && children}
                </motion.div>
            }
        </AnimatePresence>
    );
}