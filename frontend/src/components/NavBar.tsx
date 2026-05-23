import { Folder } from "../assets/icons/Folder";
import { Ripple } from "./Ripple";


export function NavBar({ content, onChange }: { content: string, onChange?: (s: string) => void }) {
    return (
        <div className="text-on-surface bg-surface p-4 shadow-2xl flex flex-row items-center justify-around *:p-1 *:text-on-primary-container">
            <Ripple className="rounded-full">
                <button disabled={content === 'nodes'} className={'disabled:text-on-disabled'} onClick={() => onChange?.('nodes')}><Folder /></button>
            </Ripple>
        </div>
    )
}
