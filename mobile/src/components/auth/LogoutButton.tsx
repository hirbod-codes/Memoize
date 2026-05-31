import { useAuth } from "../../context/authContext";
import { Button } from "../Button";

export function LogoutButton() {
    const { open } = useAuth()

    return (
        <Button variant="text" color="onSurface" icon='login' onPress={() => { open(true) }} />
    )
}
