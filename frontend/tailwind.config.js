/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}",],
    theme: {
        ripple: theme => ({
            colors: theme('colors')
        }),
        extend: {
            boxShadowColor: '#000',
            colors: {
                "primary": 'var(--primary)',
                "on-primary": 'var(--onPrimary)',
                "primary-container": 'var(--primaryContainer)',
                "on-primary-container": 'var(--onPrimaryContainer)',
                "secondary": 'var(--secondary)',
                "on-secondary": 'var(--onSecondary)',
                "secondary-container": 'var(--secondaryContainer)',
                "on-secondary-container": 'var(--onSecondaryContainer)',
                "tertiary": 'var(--tertiary)',
                "on-tertiary": 'var(--onTertiary)',
                "tertiary-container": 'var(--tertiaryContainer)',
                "on-tertiary-container": 'var(--onTertiaryContainer)',
                "error": 'var(--error)',
                "on-error": 'var(--onError)',
                "error-container": 'var(--errorContainer)',
                "on-error-container": 'var(--onErrorContainer)',
                "background": 'var(--background)',
                "on-background": 'var(--onBackground)',
                "surface": 'var(--surface)',
                "on-surface": 'var(--onSurface)',
                "surface-variant": 'var(--surfaceVariant)',
                "on-surface-variant": 'var(--onSurfaceVariant)',
                "outline": 'var(--outline)',
                "outline-variant": 'var(--outlineVariant)',
                "shadow": 'var(--shadow)',
                "scrim": 'var(--scrim)',
                "inverse-surface": 'var(--inverseSurface)',
                "inverse-on-surface": 'var(--inverseOnSurface)',
                "inverse-primary": 'var(--inversePrimary)',
                "on-disabled": "var(--onDisabled)",
                "disabled": "var(--disabled)",
                "success": "var(--success)",
                "on-success": "var(--onSuccess)",
                "warning": "var(--warning)",
                "on-warning": "var(--onWarning)",
                scrollbar: 'hsl(var(--scrollbar))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                border: 'hsl(var(--outline-variant))',
                input: 'hsl(var(--outline))',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out'
            }
        }
    },
    plugins: [require("tailwindcss-animate"),
    require('tailwindcss-ripple')()],
}