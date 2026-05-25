import { Folder } from "../assets/icons/Folder";
import { Button } from "./Button";

export function NavBar({ content, onChange }: { content: string, onChange?: (s: string) => void }) {
    return (
        <div className="bg-primary-container p-4 flex flex-row items-center justify-around *:p-1 *:text-on-primary-container">
            <Button variant="text" isIcon disabled={content === 'nodes'} className={'disabled:text-on-disabled'} onClick={() => onChange?.('nodes')}><Folder /></Button>
        </div>
    )
}
