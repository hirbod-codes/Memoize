import { useAuth } from "../../contexts/AuthContext"
import { LoginButton } from "./LoginButton"
import { LogoutButton } from "./LogoutButton"

export function AuthButtons() {
    const { accessToken } = useAuth()

    return (
        accessToken !== undefined
            ? <LogoutButton />
            : <LoginButton />

    )
}