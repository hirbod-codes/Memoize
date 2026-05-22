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
import { LeafContext, type Content, type Leaf } from '../../LeafManager'
import { useContext } from 'react'

export function Editor({ contentIndex, valueIndex, limit }: { contentIndex: number, valueIndex: number, limit?: number }) {
    const { notify } = useNotification()
    const { jsonAuthFetch } = useAuth()

    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editable = leafContext.editing
    const content: Content = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex]

    if (!content || content.type !== 'richText')
        return null

    const editor = useEditor({
        editable,
        extensions: [
            StarterKit.configure({
                bold: {
                    HTMLAttributes: {
                        class: 'border border-red-500'
                    }
                },
                blockquote: {
                    HTMLAttributes: {
                        class: 'border border-red-500'
                    }
                },
                codeBlock: {
                    HTMLAttributes: {
                        class: 'border border-red-500',
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

        content: content.value[valueIndex] ? JSON.parse(content.value[valueIndex]) : '',

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

            const result = await leafContext.updateLeaf(leaf)
            if (result === false)
                return false

            leafContext.onLeafChange(leaf)
        },
    })

    if (!editor)
        return null

    return (
        <div className="w-full p-2 flex flex-col gap-1">
            <Toolbar editor={editor} />

            <EditorContent className='border border-outline rounded-lg p-2' editor={editor} />

            <div className="border border-outline rounded-lg p-2">
                Character count:{' '}
                {editor.storage.characterCount.characters()}
            </div>
        </div>
    )
}