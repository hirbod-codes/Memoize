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
                    className={cn("size-full", className)}
                    style={style}
                    onAnimationComplete={() => setAnimationComplete(true)}
                >
                    {
                        animationComplete
                            ? children
                            : <div className="grow flex items-center justify-center size-full">
                                <div className="size-20 border-4 border-on-surface border-t-primary rounded-full animate-spin" />
                            </div>
                    }
                </motion.div>
            }
        </AnimatePresence>
    );
}