import { useState } from 'react'
import { ThemeContextProvider } from './contexts/ThemeOptionsContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { TopBar } from './components/TopBar'
import { AudioContextProvider } from './contexts/AudioContext'
import { NavBar } from './components/NavBar'
import { ArtistContextProvider } from './contexts/ArtistContext'
import { Nodes } from './components/new/Nodes'

function App() {
    const [content, setContent] = useState('nodes')

    return (
        <ThemeContextProvider>
            <NotificationProvider>
                <AuthProvider>
                    <AudioContextProvider>
                        <ArtistContextProvider>
                            <div className="text-on-surface bg-surface size-full flex flex-col overflow-hidden">
                                <TopBar />

                                <div className="grow overflow-auto">
                                    {content === 'nodes' && <Nodes />}
                                </div>

                                <NavBar content={content} onChange={(v) => setContent(v)} />
                            </div>
                        </ArtistContextProvider>
                    </AudioContextProvider>
                </AuthProvider>
            </NotificationProvider>
        </ThemeContextProvider>
    )
}

export default App
