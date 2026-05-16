import { AnimatePresence, motion } from "framer-motion";
import type { Notification } from "../contexts/NotificationContext";
import { X } from "../assets/icons/X";

export function NotificationContainer({ notifications, onClose }: { notifications: Notification[], onClose?: (id: number) => void }) {
    return (
        <AnimatePresence>
            {notifications.map((n) => {
                let on: string, c: string
                switch (n.type) {
                    case 'success':
                        c = 'bg-success'
                        on = 'text-on-success'
                        break;

                    case 'error':
                        c = 'bg-error'
                        on = 'text-on-error'
                        break;

                    case 'warning':
                        c = 'bg-warning'
                        on = 'text-on-warning'
                        break;

                    case 'primary':
                        c = 'bg-primary'
                        on = 'text-on-primary'
                        break;

                    case 'secondary':
                        c = 'bg-secondary'
                        on = 'text-on-secondary'
                        break;

                    case 'primary-container':
                        c = 'bg-primary-container'
                        on = 'text-on-primary-container'
                        break;

                    case 'secondary-container':
                        c = 'bg-secondary-container'
                        on = 'text-on-secondary-container'
                        break;

                    case 'surface':
                        c = 'bg-surface'
                        on = 'text-on-surface'
                        break;

                    case 'surface-variant':
                        c = 'bg-surface-variant'
                        on = 'text-on-surface-variant'
                        break;

                    case 'inverse-surface':
                        c = 'bg-inverse-surface'
                        on = 'text-on-inverse-surface'
                        break;

                    default:
                        c = 'bg-surface'
                        on = 'text-on-surface'
                        break;
                }
                return (
                    <motion.div
                        key={n.id}
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0, 1, 0.5, 1] }}
                        className={`${c} ${on} p-2 rounded-xl shadow-lg m-1 relative bottom-12 left-0 z-50 space-y-2`}
                    >
                        <div className="pointer-events-auto flex flex-row gap-1 items-center justify-between">
                            <div className={`${on}`}>
                                {n.message}
                            </div>

                            {/* Separator */}
                            <div className="px-2" />

                            <button className={`${on}`} onClick={() => onClose?.(n.id)}>
                                <X />
                            </button>
                        </div>
                    </motion.div>
                );
            })}
        </AnimatePresence>
    );
}