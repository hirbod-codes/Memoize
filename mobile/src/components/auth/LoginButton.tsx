import { useAuth } from "../../context/authContext";
import { Button } from "../Button";

export function LoginButton() {
    const { open } = useAuth()

    return (
        <Button variant="text" bg="onSurface" icon='login' onPress={() => { open(true) }} />
    )
}
