import { useNotification } from "../../contexts/NotificationContext";
import { logout } from "./Auth"
import { Ripple } from "../Ripple"
import { Logout } from "../../assets/icons/Logout";

export function LogoutButton() {
    const { notify } = useNotification();

    return (
        <Ripple>
            <button className='border-outline' onClick={async () => {
                const res = await logout()
                if (res === false)
                    notify('Logout failed!', 3000, 'error')
                else if (res.ok)
                    window.location.reload();
            }}>
                <Logout />
            </button>
        </Ripple>
    )
}
