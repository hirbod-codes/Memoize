import { EditorContent, useEditor, } from '@tiptap/react'

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { Toolbar } from './Toolbar'
import { useAuth } from '../../../contexts/AuthContext'
import { useNotification } from '../../../contexts/NotificationContext'
import type { Content, Leaf } from '../../LeafManager'

export function Editor({ leaf, contentIndex, isTerm, valueIndex, editable, onLeafChange, limit }: { leaf: Leaf, contentIndex: number, isTerm: boolean, valueIndex: number, editable: boolean, onLeafChange?: (jsonContent: string) => void, limit?: number }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const content: Content = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex]

    if (!content || content.type !== 'richText')
        return null

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

        content: JSON.parse(content.value[valueIndex]),

        editorProps: {
            attributes: {
                class: 'editor-content',
            },
        },

        onUpdate: async ({ editor }) => {
            const json = editor.getJSON()
            const jsonString = JSON.stringify(json)

            console.log(json)

            leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value[valueIndex] = jsonString

            let r = await jsonAuthFetch('/api/leaf', { method: 'PUT', body: JSON.stringify(leaf) })
            if (r === false || !r.ok)
                return notify('Failed to update', 3000, 'error')

            onLeafChange?.(jsonString)
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