import { Login } from "../../assets/icons/Login"
import { useAuth } from "../../contexts/AuthContext"
import { Button } from "../Button"

export function LoginButton() {
    const auth = useAuth()

    return (
        <Button variant="text" color="on-surface" isIcon onPointerDown={() => auth.open(true)}>
            <Login />
        </Button >
    )
}
