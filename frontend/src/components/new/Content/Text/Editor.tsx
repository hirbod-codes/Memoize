import { EditorContent, useEditor, } from '@tiptap/react'

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { Toolbar } from './Toolbar'

export function Editor({ editable, limit }: { editable: boolean, limit?: number }) {
    const editor = useEditor({
        editable,
        extensions: [
            StarterKit.configure({
                codeBlock: {
                    HTMLAttributes: {
                        class: 'editor-code-block',
                    },
                },
            }),

            Placeholder.configure({
                placeholder:
                    'Write something amazing...',
            }),

            Link.configure({
                openOnClick: 'whenNotEditable',
            }),

            Underline,

            CharacterCount.configure({
                limit,
            }),

            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],

        content: `
            <h2>Welcome</h2>
            <p>
                This is a customized Tiptap editor.
            </p>
        `,

        editorProps: {
            attributes: {
                class: 'editor-content',
            },
        },

        onUpdate({ editor }) {
            const json = editor.getJSON()

            console.log(json)

            // Save to backend here
        },
    })

    if (!editor)
        return null

    return (
        <div className="editor-shell">
            <Toolbar editor={editor} />

            <EditorContent editor={editor} />

            <div className="editor-footer">
                Character count:{' '}
                {editor.storage.characterCount.characters()}
            </div>
        </div>
    )
}