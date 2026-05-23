import { useState } from 'react'
import { ThemeContextProvider } from './contexts/ThemeOptionsContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { TopBar } from './components/TopBar'
import { NavBar } from './components/NavBar'
import { Nodes } from './components/Nodes'

function App() {
    const [content, setContent] = useState('nodes')

    return (
        <ThemeContextProvider>
            <NotificationProvider>
                <AuthProvider>
                    <div className="text-on-surface-variant bg-surface-variant size-full flex flex-col overflow-hidden">
                        <TopBar />

                        <div className="grow overflow-hidden">
                            {content === 'nodes' && <Nodes />}
                        </div>

                        <NavBar content={content} onChange={(v) => setContent(v)} />
                    </div>
                </AuthProvider>
            </NotificationProvider>
        </ThemeContextProvider>
    )
}

export default App
