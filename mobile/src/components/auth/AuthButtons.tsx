import { useAccessToken } from "../../stores/accessToken"
import { LoginButton } from "./LoginButton"
import { LogoutButton } from "./LogoutButton"

export function AuthButtons() {
    return (
        useAccessToken.getState().accessToken
            ? <LogoutButton />
            : <LoginButton />

    )
}