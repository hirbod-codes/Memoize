// import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { ThemeProvider } from './theme/ThemeProvider';
import { TopBar } from './components/TopBar';
import { AuthProvider } from './context/authContext';

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <View className='bg-surface h-full flex flex-col items-center justify-start'>
                    <TopBar />

                    <View>
                        <Text className='text-on-surface'>Open up App.tsx to start working on your app!</Text>
                    </View>
                </View>
            </AuthProvider>
        </ThemeProvider>
    );
}
