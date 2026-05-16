import { useState } from 'react'
import { AudioUpload } from './components/AudioUpload'
import { ThemeContextProvider } from './contexts/ThemeOptionsContext'
import { Search } from './components/Search'
import { NotificationProvider } from './contexts/NotificationContext'
import { AuthProvider } from './contexts/AuthContext'
import { TopBar } from './components/TopBar'
import { AudioContextProvider } from './contexts/AudioContext'
import { NavBar } from './components/NavBar'
import { ArtistContextProvider } from './contexts/ArtistContext'
import { Playlists } from './components/Playlists'

function App() {
    const [content, setContent] = useState('search')

    return (
        <ThemeContextProvider>
            <NotificationProvider>
                <AuthProvider>
                    <AudioContextProvider>
                        <ArtistContextProvider>
                            <div className="text-on-surface bg-surface size-full flex flex-col overflow-hidden">
                                <TopBar />

                                <div className="grow overflow-auto">
                                    {content === 'search' && <Search />}
                                    {content === 'upload' && <AudioUpload />}
                                    {content === 'playlists' && <Playlists />}
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
