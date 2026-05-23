import { Editor } from '@tiptap/react'
import { Bold } from '../../../assets/icons/Bold'
import { Italic } from '../../../assets/icons/Italic'
import { Underline } from '../../../assets/icons/Underline'
import { Heading1 } from '../../../assets/icons/Heading1'
import { Heading2 } from '../../../assets/icons/Heading2'
import { CircleSmall } from '../../../assets/icons/CircleSmall'
import { Code } from '../../../assets/icons/Code'
import { TextAlignStart } from '../../../assets/icons/TextAlignStart'
import { TextAlignCenter } from '../../../assets/icons/TextAlignCenter'
import { TextAlignEnd } from '../../../assets/icons/TextAlignEnd'
import { Undo } from '../../../assets/icons/Undo'
import { Redo } from '../../../assets/icons/Redo'
import { Link } from '../../../assets/icons/Link'
import { ListOrdered } from '../../../assets/icons/ListOrdered'

type Props = { editor: Editor }

export function Toolbar({ editor }: Props) {
    function setLink() {
        const previousUrl = editor.getAttributes('link').href

        const url = window.prompt('Enter URL', previousUrl)

        if (url === null)
            return

        if (url === '') {
            editor
                .chain()
                .focus()
                .unsetLink()
                .run()

            return
        }

        editor
            .chain()
            .focus()
            .setLink({ href: url })
            .run()
    }

    const toggle = (name: 'Bold' | 'Italic' | 'Underline' | 'Heading' | 'BulletList' | 'OrderedList' | 'CodeBlock' | 'TextAlign' | 'undo' | 'redo', rest?: any) => {
        let func: 'undo' | 'redo' | 'toggleBold' | 'toggleItalic' | 'toggleUnderline' | 'toggleHeading' | 'toggleBulletList' | 'toggleOrderedList' | 'toggleCodeBlock' | 'toggleTextAlign'

        if (name === 'undo' || name === 'redo')
            func = name;
        else
            func = `toggle${name}`;

        (
            editor
                .chain()
                .focus()
            [func] as any
        )(rest)
            .run()
    }

    return (
        <div className="*:border *:border-outline *:p-1 *:rounded-lg border border-outline p-2 rounded-lg flex flex-row flex-wrap gap-1 w-full">
            <button onClick={() => toggle('undo')}>
                <Undo />
            </button>

            <button onClick={() => toggle('redo')}>
                <Redo />
            </button>

            <button onClick={() => toggle('Bold')}>
                <Bold />
            </button>

            <button onClick={() => toggle('Italic')} >
                <Italic />
            </button>

            <button onClick={() => toggle('Underline')} >
                <Underline />
            </button>

            <button onClick={() => toggle('Heading', { level: 1 })}>
                <Heading1 />
            </button>

            <button onClick={() => toggle('Heading', { level: 2 })}>
                <Heading2 />
            </button>

            <button onClick={() => toggle('BulletList')}>
                <CircleSmall />
            </button>

            <button onClick={() => toggle('OrderedList')}>
                <ListOrdered />
            </button>

            <button onClick={setLink}>
                <Link />
            </button>

            <button onClick={() => toggle('CodeBlock')}>
                <Code />
            </button>

            <button onClick={() => toggle('TextAlign', 'left')}>
                <TextAlignStart />
            </button>

            <button onClick={() => toggle('TextAlign', 'center')}>
                <TextAlignCenter />
            </button>

            <button onClick={() => toggle('TextAlign', 'right')}>
                <TextAlignEnd />
            </button>
        </div>
    )
}