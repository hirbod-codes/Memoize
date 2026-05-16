import { useState } from "react";
import { Ripple } from "../Ripple";
import { useNotification } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";

export const logout = async () => {
    try {
        return await fetch('/api/auth/logout', { credentials: 'include', method: 'POST', headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
        console.error(err);
        return false
    }
}

export function Auth({ onClose }: { onClose?: () => void }) {
    const { setAccessToken, jsonFetch } = useAuth();
    const { notify } = useNotification();

    const [openRegister, setOpenRegister] = useState(false)

    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')

    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const reset = () => {
        setIdentifier('')
        setPassword('')
        setConfirmPassword('')

        setUsername('')
        setEmail('')
        setPhoneNumber('')
    }

    const submit = async () => {
        if (openRegister)
            submitRegister()
        else
            submitLogin()
    }

    const submitRegister = async () => {
        const data = {} as any

        if (username !== '')
            data.username = username
        else if (email)
            data.email = email
        else
            data.phoneNumber = phoneNumber

        data.password = password

        const result = await jsonFetch('/api/auth/register', { credentials: 'include', method: 'POST', body: JSON.stringify(data) })
        let body
        if (result.headers.has('Content-Type') && result.headers.get('Content-Type')?.includes('application/json'))
            body = await result.json()
        console.log({ body })
        if (result.ok) {
            setAccessToken(body.accessToken)
            notify('successful', 3000, 'success')
            onClose?.()
            window.location.reload();
        } else
            notify(body?.message ?? 'Register failed', 3000, 'error')
    }

    const submitLogin = async () => {
        const data = {} as any

        data.identifier = identifier
        data.password = password

        const result = await jsonFetch('/api/auth/login', { credentials: 'include', method: 'POST', body: JSON.stringify(data) })
        let body
        if (result.headers.has('Content-Type') && result.headers.get('Content-Type')?.includes('application/json'))
            body = await result.json()
        console.log({ body })
        if (result.ok) {
            setAccessToken(body.accessToken)
            notify('successful', 3000, 'success')
            onClose?.()
        } else
            notify(body?.message ?? 'Login failed', 3000, 'error')
    }

    const registerFieldsEmpty = username === '' && email === '' && phoneNumber === ''
    const disabled = openRegister
        ? (registerFieldsEmpty || password !== confirmPassword)
        : (identifier === '' || password === '')

    return (
        <div className="flex flex-col items-center *:w-full gap-2 size-full rounded-2xl text-on-surface-variant bg-surface-variant shadow-2xl p-4 border">
            {openRegister &&
                <>
                    {registerFieldsEmpty && <div className="text-error">One identifier is required.</div>}
                    <input
                        className={`p-1 rounded border bg-surface text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Username"
                        onChange={(e) => setUsername(e.target.value)}
                        value={username}
                    />
                    <input
                        className={`p-1 rounded border bg-surface text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Email"
                        onChange={(e) => setEmail(e.target.value)}
                        value={email}
                    />
                    <input
                        className={`p-1 rounded border bg-surface text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Phone number"
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        value={phoneNumber}
                    />

                    <input
                        className="p-1 rounded border border-outline bg-surface text-on-surface"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                        value={password}
                    />

                    <input
                        className={`p-1 rounded border bg-surface text-on-surface ${password !== confirmPassword ? 'border-error' : 'border-outline'}`}
                        placeholder="Confirm Password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        value={confirmPassword}
                    />
                </>
            }

            {!openRegister &&
                <>
                    <input
                        className="p-1 rounded border border-outline bg-surface text-on-surface"
                        placeholder="Username / Email / Phone number"
                        onChange={(e) => setIdentifier(e.target.value)}
                        value={identifier}
                    />

                    <input
                        className="p-1 rounded border border-outline bg-surface text-on-surface"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                        value={password}
                    />
                </>
            }

            <div className="grow" />

            <Ripple>
                <button className="w-full border border-outline rounded bg-primary text-on-primary" onClick={submit} disabled={disabled}>
                    Submit
                </button>
            </Ripple>
            <Ripple>
                <button className="w-full border border-outline rounded bg-primary text-on-primary" onClick={() => { reset(); setOpenRegister(!openRegister) }}>
                    {openRegister ? 'Login' : 'Sign Up'}
                </button>
            </Ripple>
        </div>
    )
}
