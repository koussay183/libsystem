import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Dialog, Portal, Text } from '@chakra-ui/react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { syncStore } from '@/lib/syncStatus'

/**
 * Logout, behind a question.
 *
 * Signing back in needs the network, so one stray tap with the line down
 * locks the shop out of its own till until internet returns. The dialog says
 * so in red when there is no line or work still waiting, and the safe choice
 * — staying signed in — is the primary button.
 */
export function LogoutButton() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot, syncStore.getSnapshot)
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const waiting = sync.pending + sync.carried
  const offline = !sync.online
  const risky = offline || waiting > 0

  const confirm = async () => {
    setLeaving(true)
    // logout() ends with a full reload to /login, so nothing after it runs.
    await logout()
  }

  return (
    <>
      <Button
        h="3rem"
        css={{ '@media (max-height: 860px)': { height: '2.25rem' } }}
        w="full"
        justifyContent="flex-start"
        gap={3}
        px={3}
        variant="ghost"
        color="fg.muted"
        fontWeight="semibold"
        borderRadius="l3"
        onClick={() => setOpen(true)}
      >
        <LogOut size={20} />
        {t('common.logout')}
      </Button>

      <Dialog.Root
        lazyMount
        unmountOnExit
        role="alertdialog"
        open={open}
        onOpenChange={(e) => !leaving && setOpen(e.open)}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{t('platformFix.logoutTitle')}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {risky ? (
                  <Alert.Root status="error">
                    <Alert.Indicator />
                    <Alert.Content>
                      {offline && <Alert.Title>{t('platformFix.logoutOffline')}</Alert.Title>}
                      {waiting > 0 && (
                        <Alert.Description>
                          {t('platformFix.logoutPending', { count: waiting })}
                        </Alert.Description>
                      )}
                    </Alert.Content>
                  </Alert.Root>
                ) : (
                  <Text color="fg.muted">{t('platformFix.logoutBody')}</Text>
                )}
              </Dialog.Body>
              <Dialog.Footer flexWrap="wrap">
                <Button
                  size="lg"
                  variant="outline"
                  colorPalette={risky ? 'red' : 'gray'}
                  loading={leaving}
                  onClick={confirm}
                >
                  <LogOut size={18} />
                  {risky ? t('platformFix.logoutAnyway') : t('common.logout')}
                </Button>
                <Button size="lg" colorPalette="brand" disabled={leaving} onClick={() => setOpen(false)}>
                  {t('platformFix.logoutStay')}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
