import { useState } from "react";

export function Select({ children, label, onChange, labelProps, containerProps, selectProps }: { children: React.ReactNode, label?: string, onChange?: React.ChangeEventHandler<HTMLSelectElement, HTMLSelectElement>, labelProps?: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, containerProps?: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>, selectProps?: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement> }) {
    const [value, setValue] = useState("flat");

    return (
        <div {...containerProps}>
            <label {...labelProps}>{label ?? 'Select'}</label>

            <select
                {...selectProps}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const preset = e.target.value

                    setValue(preset);
                    onChange?.(e)
                }}
            >
                {children}
            </select>
        </div >
    );
}