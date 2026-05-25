import { EditorContent, useEditor, } from '@tiptap/react'

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { Toolbar } from './Toolbar'
import { LeafContext, type Content } from '../../LeafManager'
import { useContext, useState } from 'react'
import { Button } from '../../Button'
import { Save } from '../../../assets/icons/Save'

export function Editor({ contentIndex, valueIndex, limit }: { contentIndex: number, valueIndex: number, limit?: number }) {
    const leafContext = useContext(LeafContext)
    if (!leafContext)
        return null

    const leaf = leafContext.leaf
    const isTerm = leafContext.isTerm
    const editable = leafContext.editing
    const content: Content = leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex]

    if (!content || content.type !== 'richText')
        return null

    const [saving, setSaving] = useState(false)
    const [hasSaved, setHasSaved] = useState(true)

    const handleSave = async () => {
        if (saving)
            return

        setSaving(true)
        try {
            if (await save())
                setHasSaved(true)

            setSaving(false)
        } catch (error) {
            setSaving(false)
        }
    }

    const save = async () => {
        console.log(jsonContent)

        const jsonString = JSON.stringify(jsonContent)

        leaf[isTerm ? 'termContents' : 'definitionContents'][contentIndex].value[valueIndex] = jsonString

        const result = await leafContext.updateLeaf(leaf)
        console.log({ result })
        if (result === false)
            return false

        leafContext.onLeafChange(leaf)

        return true
    }

    const [jsonContent, setJsonContent] = useState<any>(undefined)

    const editor = useEditor({
        editable,
        extensions: [
            StarterKit.configure({}),

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

        onUpdate: ({ editor }) => {
            setHasSaved(false)
            setJsonContent(editor.getJSON())
        },
    }, [editable, content.value[valueIndex]])

    if (!editor)
        return null

    return (
        <div className="w-full p-2 flex flex-col gap-1">

            {
                editor.isEditable &&
                <Toolbar editor={editor} />
            }

            <EditorContent className='border border-outline rounded-lg p-2' editor={editor} />

            <div className="flex flex-row items-center justify-between text-current">
                <div className="border border-outline rounded-lg p-2">
                    Character count:{' '}
                    {editor.storage.characterCount.characters()}
                </div>

                {
                    editor.isEditable &&
                    <Button isIcon variant='text' color={hasSaved ? 'primary' : 'warning'} className='rounded-md' onPointerDown={handleSave}>
                        <Save />
                    </Button>
                }
            </div>
        </div>
    )
}