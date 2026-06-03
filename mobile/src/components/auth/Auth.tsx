import { useState } from "react";
import { TextInput, View } from "react-native";
import { login, register } from "../../services/auth";
import { Button } from "../Button";
import { themeColors } from "../../theme/themes";

export function Auth({ onClose }: { onClose?: () => void }) {
    // const { notify } = useNotification();

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
        try {
            if (openRegister)
                await register(password, username, email, phoneNumber)
            else
                await login(identifier, password)

            onClose?.()
        } catch (error) {
            console.error(error)
        }
    }

    const registerFieldsEmpty = username === '' && email === '' && phoneNumber === ''
    const disabled = openRegister
        ? (registerFieldsEmpty || password !== confirmPassword)
        : (identifier === '' || password === '')

    return (
        <View className="flex flex-col items-center *:w-full gap-2 w-full rounded-lg text-on-surface bg-surface-container-high p-4">
            {openRegister &&
                <>
                    {registerFieldsEmpty && <View className="text-error">One identifier is required.</View>}
                    <TextInput
                        className={`w-full p-4 rounded-lg border bg-surface-container-highest text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Username"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setUsername(e)}
                        value={username}
                    />
                    <TextInput
                        className={`w-full p-4 rounded-lg border bg-surface-container-highest text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Email"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setEmail(e)}
                        value={email}
                    />
                    <TextInput
                        className={`w-full p-4 rounded-lg border bg-surface-container-highest text-on-surface ${registerFieldsEmpty ? 'border-error' : 'border-outline'}`}
                        placeholder="Phone number"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setPhoneNumber(e)}
                        value={phoneNumber}
                    />

                    <TextInput
                        className="w-full p-4 rounded-lg border border-outline bg-surface-container-highest text-on-surface"
                        placeholder="Password"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setPassword(e)}
                        value={password}
                    />

                    <TextInput
                        className={`w-full p-4 rounded-lg border bg-surface-container-highest text-on-surface ${password !== confirmPassword ? 'border-error' : 'border-outline'}`}
                        placeholder="Confirm Password"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setConfirmPassword(e)}
                        value={confirmPassword}
                    />
                </>
            }

            {!openRegister &&
                <>
                    <TextInput
                        className="w-full p-4 rounded-lg border border-outline bg-surface-container-highest text-on-surface"
                        placeholder="Username / Email / Phone number"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        onChangeText={(e) => setIdentifier(e)}
                        value={identifier}
                    />

                    <TextInput
                        className="w-full p-4 rounded-lg border border-outline bg-surface-container-highest text-on-surface"
                        placeholderTextColor={`rgba(${themeColors['dark'].onSurface} / 0.38)`}
                        placeholder="Password"
                        onChangeText={(e) => setPassword(e)}
                        value={password}
                    />
                </>
            }

            <View className="p-12" />

            <Button variant="filled" bg="primary" className='w-full rounded-lg' title="Submit" onPress={submit} disabled={disabled} />

            <Button variant="filled" bg="primary" className='w-full rounded-lg' title={openRegister ? 'Login' : 'Sign Up'} onPress={() => { reset(); setOpenRegister(!openRegister) }} />
        </View>
    )
}
