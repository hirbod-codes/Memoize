import { View } from 'react-native';
import { ThemeProvider } from './theme/ThemeProvider';
import { TopBar } from './components/TopBar';
import { AuthProvider } from './context/authContext';
import { NotificationsProvider } from './context/NotificationProvider';
import { Home } from './pages/Home';

export default function App() {
    return (
        <ThemeProvider>
            <NotificationsProvider>
                <AuthProvider>
                    <View className='bg-surface h-full flex flex-col items-center justify-start'>
                        <TopBar />

                        <Home />
                    </View>
                </AuthProvider>
            </NotificationsProvider>
        </ThemeProvider>
    );
}
