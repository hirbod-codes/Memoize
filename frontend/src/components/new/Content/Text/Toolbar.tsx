import { Editor } from '@tiptap/react'

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

    return (
        <div className="toolbar">
            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleBold()
                        .run()
                }
            >
                Bold
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleItalic()
                        .run()
                }
            >
                Italic
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleUnderline()
                        .run()
                }
            >
                Underline
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleHeading({
                            level: 1,
                        })
                        .run()
                }
            >
                H1
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleHeading({
                            level: 2,
                        })
                        .run()
                }
            >
                H2
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleBulletList()
                        .run()
                }
            >
                Bullet List
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleOrderedList()
                        .run()
                }
            >
                Ordered List
            </button>

            <button onClick={setLink}>
                Link
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .toggleCodeBlock()
                        .run()
                }
            >
                Code
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .setTextAlign('left')
                        .run()
                }
            >
                Left
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .setTextAlign('center')
                        .run()
                }
            >
                Center
            </button>

            <button
                onClick={() =>
                    editor
                        .chain()
                        .focus()
                        .setTextAlign('right')
                        .run()
                }
            >
                Right
            </button>
        </div>
    )
}