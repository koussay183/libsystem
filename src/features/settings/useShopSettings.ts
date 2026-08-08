import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ShopSettings } from '@/types/models'

const REF = () => doc(db, 'settings', 'shop')

export const DEFAULT_SHOP: ShopSettings = {
  name: 'Librairie',
  footer: 'Merci et à bientôt !',
}

/**
 * The shop identity printed at the top of every ticket. A single document, so
 * one live subscription is enough and the till always prints the current name
 * without a reload.
 */
export function useShopSettings() {
  const [shop, setShop] = useState<ShopSettings>(DEFAULT_SHOP)
  const [loading, setLoading] = useState(true)

  useEffect(
    () =>
      onSnapshot(
        REF(),
        (snap) => {
          if (snap.exists()) {
            setShop({ ...DEFAULT_SHOP, ...(snap.data() as ShopSettings) })
          }
          setLoading(false)
        },
        // An unreadable settings doc must not stop the shop from selling.
        () => setLoading(false),
      ),
    [],
  )

  return { shop, loading }
}

export async function saveShopSettings(settings: ShopSettings) {
  await setDoc(REF(), { ...settings, updatedAt: Date.now() }, { merge: true })
}
