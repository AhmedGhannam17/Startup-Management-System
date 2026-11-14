'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

export type QuotationLineInput = {
  description: string
  quantity: number
  unit_price: number
  discount_percent: number
  tax_percent: number
  sort_order: number
}

type LineDraft = {
  description: string
  quantity: string
  unit_price: string
  discount_percent: string
  tax_percent: string
}

const emptyLine = (): LineDraft => ({
  description: '',
  quantity: '1',
  unit_price: '0',
  discount_percent: '0',
  tax_percent: '0',
})

function number(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function QuotationLineItems({
  currency,
  initialItems,
}: {
  currency: string
  initialItems?: QuotationLineInput[]
}) {
  const [items, setItems] = useState<LineDraft[]>(
    initialItems?.length
      ? initialItems.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unit_price: String(item.unit_price),
          discount_percent: String(item.discount_percent),
          tax_percent: String(item.tax_percent),
        }))
      : [emptyLine()]
  )
  const totals = useMemo(
    () =>
      items.reduce(
        (sum, item) => {
          const gross = number(item.quantity) * number(item.unit_price)
          const discount = gross * (number(item.discount_percent) / 100)
          const taxable = gross - discount
          sum.subtotal += taxable
          sum.tax += taxable * (number(item.tax_percent) / 100)
          return sum
        },
        { subtotal: 0, tax: 0 }
      ),
    [items]
  )
  const serializedItems: QuotationLineInput[] = items.map((item, index) => ({
    description: item.description.trim(),
    quantity: number(item.quantity),
    unit_price: number(item.unit_price),
    discount_percent: number(item.discount_percent),
    tax_percent: number(item.tax_percent),
    sort_order: index,
  }))

  function updateItem(index: number, key: keyof LineDraft, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    )
  }

  return (
    <section className="space-y-4 rounded-lg border p-4" aria-labelledby="line-items-heading">
      <input type="hidden" name="lineItems" value={JSON.stringify(serializedItems)} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="line-items-heading" className="font-semibold">
            Items and totals
          </h2>
          <p className="text-xs text-muted-foreground">
            Discount applies before tax for each line.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setItems((current) => [...current, emptyLine()])}
        >
          Add item
        </Button>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <fieldset
            key={index}
            className="grid gap-3 rounded-md border bg-muted/10 p-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <legend className="px-1 text-xs font-medium text-muted-foreground">
              Item {index + 1}
            </legend>
            <label className="space-y-1 text-xs sm:col-span-2 lg:col-span-2">
              Description *
              <input
                required
                maxLength={500}
                value={item.description}
                onChange={(event) => updateItem(index, 'description', event.target.value)}
                className="field-input"
              />
            </label>
            {(
              [
                ['quantity', 'Qty', '0.001'],
                ['unit_price', 'Unit price', '0.01'],
                ['discount_percent', 'Discount %', '0.01'],
                ['tax_percent', 'Tax %', '0.01'],
              ] as const
            ).map(([key, label, step]) => (
              <label key={key} className="space-y-1 text-xs">
                {label}
                <input
                  type="number"
                  min={key === 'quantity' ? '0.001' : '0'}
                  max={key.includes('percent') ? '100' : undefined}
                  step={step}
                  value={item[key]}
                  onChange={(event) => updateItem(index, key, event.target.value)}
                  className="field-input"
                />
              </label>
            ))}
            {items.length > 1 && (
              <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() =>
                    setItems((current) => {
                      const reordered = [...current]
                      const previous = reordered[index - 1]
                      reordered[index - 1] = reordered[index]
                      reordered[index] = previous
                      return reordered
                    })
                  }
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === items.length - 1}
                  onClick={() =>
                    setItems((current) => {
                      const reordered = [...current]
                      const next = reordered[index + 1]
                      reordered[index + 1] = reordered[index]
                      reordered[index] = next
                      return reordered
                    })
                  }
                >
                  Move down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remove item
                </Button>
              </div>
            )}
          </fieldset>
        ))}
      </div>
      <div className="ml-auto grid max-w-sm grid-cols-2 gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Subtotal after discounts</span>
        <span className="text-right">{money(totals.subtotal, currency)}</span>
        <span className="text-muted-foreground">Tax</span>
        <span className="text-right">{money(totals.tax, currency)}</span>
        <span className="font-semibold">Total</span>
        <span className="text-right font-semibold">
          {money(totals.subtotal + totals.tax, currency)}
        </span>
      </div>
    </section>
  )
}
