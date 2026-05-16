import { Login } from "../../assets/icons/Login"
import { useAuth } from "../../contexts/AuthContext"
import { Ripple } from "../Ripple"

export function LoginButton() {
    const auth = useAuth()

    return (
        <Ripple>
            <button className='border-outline' onClick={() => auth.open(true)}>
                <Login />
            </button>
        </Ripple>
    )
}
