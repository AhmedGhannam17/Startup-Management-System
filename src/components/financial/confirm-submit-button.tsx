'use client'

import { Button, type ButtonProps } from '@/components/ui/button'

export function ConfirmSubmitButton({
  confirmation,
  children,
  ...props
}: ButtonProps & { confirmation: string }) {
  return (
    <Button
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmation)) {
          event.preventDefault()
          return
        }
        props.onClick?.(event)
      }}
    >
      {children}
    </Button>
  )
}
