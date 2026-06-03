import { useAuth } from "../../context/authContext";
import { logout } from "../../services/auth";
import { useAccessToken } from "../../stores/accessToken";
import { getRefreshToken, removeRefreshToken } from "../../stores/refreshToken";
import { Button } from "../Button";

export function LogoutButton() {
    const { open } = useAuth()
    const { setAccessToken, accessToken } = useAccessToken()

    const handleLogout = async () => {
        try {
            const refreshToken = await getRefreshToken()
            if (!refreshToken)
                throw new Error('User is not logged in.')

            await logout(refreshToken, accessToken)
            await removeRefreshToken()
            setAccessToken(null)
            open(true)
        } catch (error) {
            console.error(error);
        }
    }

    return (<Button variant="text" bg="onSurface" icon='logout' onPress={handleLogout} />)
}
