import { forwardRef, useCallback, useRef, useState } from 'react'
import { Input } from '@chakra-ui/react'
import type { InputProps } from '@chakra-ui/react'
import { useBarcodeScanner } from '@/features/pos/useBarcodeScanner'
import type { BarcodeScannerOptions } from '@/features/pos/useBarcodeScanner'
import { normalizeScannedCode, scannedCode } from './barcode'

/**
 * The till's scanner hook as something that can be switched on and off.
 *
 * useBarcodeScanner listens on the whole window and borrows whatever field has
 * the focus, so two of them alive at once fight over every scan: one puts the
 * field back while the other fills it. A hook cannot be called conditionally,
 * a component can be mounted conditionally — so each screen mounts this only
 * while it is the one the scanner should talk to (no dialog over it).
 */
export function ScanWedge(props: BarcodeScannerOptions) {
  useBarcodeScanner(props)
  return null
}

type BarcodeInputProps = Omit<InputProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  /** Called once a scanner burst has landed in the field, with the clean code. */
  onScanned?: (code: string) => void
}

/**
 * A barcode field that reads a scan the way the till does.
 *
 * On the shop PC (AZERTY, scanner on its factory US layout) a plain Input
 * received &é"'(-è_çà instead of digits, and the scanner's trailing Enter
 * submitted the form around it. The wedge is mounted only while this field has
 * the focus, so it never borrows another field and never competes with a
 * screen-level one; the burst is replaced by the digits it meant and the
 * suffix key is swallowed. Leaving the field also repairs a code that got in
 * some other way (normalizeScannedCode).
 */
export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(function BarcodeInput(
  { value, onChange, onScanned, onFocus, onBlur, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null)
  const [focused, setFocused] = useState(false)

  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      inner.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )

  const onScan = (code: string, physical: string | null) => {
    const clean = scannedCode(code, physical)
    onChange(clean)
    onScanned?.(clean)
  }

  return (
    <>
      {focused && <ScanWedge targetRef={inner} onScan={onScan} />}
      <Input
        ref={setRefs}
        value={value}
        inputMode="numeric"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          const repaired = normalizeScannedCode(e.target.value)
          if (repaired !== e.target.value) onChange(repaired)
          onBlur?.(e)
        }}
        {...rest}
      />
    </>
  )
})
