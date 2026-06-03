import { View } from "react-native";
import { useNotification } from "../context/NotificationProvider";
import { Button } from "../components/Button";

export function Home() {
    const { notify } = useNotification();

    return (
        <View className="w-full p-4 grow flex flex-col justify-end gap-4">
            <Button title="Click" onPress={() => notify({ message: "This is a notification" })} />
        </View>
    )
}
