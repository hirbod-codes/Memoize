import { Editor, useEditorState } from '@tiptap/react'
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
import { Button } from '../../Button'

type Props = { editor: Editor }

export function Toolbar({ editor }: Props) {
    const setLink: React.PointerEventHandler<HTMLButtonElement> = (e) => {
        e.preventDefault()

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

    const editorState = useEditorState({
        editor,
        selector: ({ editor }) => ({
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            underline: editor.isActive('underline'),
            heading1: editor.isActive('heading', { level: 1 }),
            heading2: editor.isActive('heading', { level: 2 }),
            bulletList: editor.isActive('bulletList'),
            orderedList: editor.isActive('orderedList'),
            link: editor.isActive('link'),
            codeBlock: editor.isActive('codeBlock'),
            textAlignLeft: editor.isActive({ textAlign: 'left' }),
            textAlignCenter: editor.isActive({ textAlign: 'center' }),
            textAlignRight: editor.isActive({ textAlign: 'right' }),
        }),
    })

    return (
        <div className="text-current *:p-1 *:rounded-lg border border-outline p-2 rounded-lg flex flex-row flex-wrap gap-1 w-full">
            <Button isIcon variant='text' color={'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('undo') }}>
                <Undo />
            </Button>

            <Button isIcon variant='text' color={'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('redo') }}>
                <Redo />
            </Button>

            <Button isIcon variant={editorState.bold ? 'filled' : 'text'} color={editorState.bold ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('Bold'); }}>
                <Bold />
            </Button>

            <Button isIcon variant={editorState.italic ? 'filled' : 'text'} color={editorState.italic ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('Italic'); }} >
                <Italic />
            </Button>

            <Button isIcon variant={editorState.underline ? 'filled' : 'text'} color={editorState.underline ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('Underline'); }} >
                <Underline />
            </Button>

            <Button isIcon variant={editorState.heading1 ? 'filled' : 'text'} color={editorState.heading1 ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('Heading', { level: 1 }); }}>
                <Heading1 />
            </Button>

            <Button isIcon variant={editorState.heading2 ? 'filled' : 'text'} color={editorState.heading2 ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('Heading', { level: 2 }); }}>
                <Heading2 />
            </Button>

            <Button isIcon variant={editorState.bulletList ? 'filled' : 'text'} color={editorState.bulletList ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('BulletList'); }}>
                <CircleSmall />
            </Button>

            <Button isIcon variant={editorState.orderedList ? 'filled' : 'text'} color={editorState.orderedList ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('OrderedList'); }}>
                <ListOrdered />
            </Button>

            <Button isIcon variant={editorState.link ? 'filled' : 'text'} color={editorState.link ? 'secondary' : 'on-surface'} onPointerDown={setLink}>
                <Link />
            </Button>

            <Button isIcon variant={editorState.codeBlock ? 'filled' : 'text'} color={editorState.codeBlock ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('CodeBlock'); }}>
                <Code />
            </Button>

            <Button isIcon variant={editorState.textAlignLeft ? 'filled' : 'text'} color={editorState.textAlignLeft ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('TextAlign', 'left'); }}>
                <TextAlignStart />
            </Button>

            <Button isIcon variant={editorState.textAlignCenter ? 'filled' : 'text'} color={editorState.textAlignCenter ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('TextAlign', 'center'); }}>
                <TextAlignCenter />
            </Button>

            <Button isIcon variant={editorState.textAlignRight ? 'filled' : 'text'} color={editorState.textAlignRight ? 'secondary' : 'on-surface'} onPointerDown={(e) => { e.preventDefault(); toggle('TextAlign', 'right'); }}>
                <TextAlignEnd />
            </Button>
        </div>
    )
}