import { useNotification } from "../../contexts/NotificationContext";
import { logout } from "./Auth"
import { Logout } from "../../assets/icons/Logout";
import { Button } from "../Button";

export function LogoutButton() {
    const { notify } = useNotification();

    return (
        <Button variant="text" color="on-surface" isIcon onPointerDown={async () => {
            const res = await logout()
            if (res === false)
                notify('Logout failed!', 3000, 'error')
            else if (res.ok)
                window.location.reload();
        }}>
            <Logout />
        </Button >
    )
}
