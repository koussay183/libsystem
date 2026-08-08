import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Flex, Heading, Stack, Tabs, Text } from '@chakra-ui/react'
import { ReceiptText } from 'lucide-react'
import { SalesTab } from '@/features/sales/SalesTab'
import { PurchasesTab } from '@/features/purchases/PurchasesTab'

type Tab = 'sales' | 'purchases'

export function InvoicesPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('sales')

  return (
    <Box>
      <Flex align="center" gap={3} mb={5}>
        <Box bg="brand.subtle" color="brand.fg" p={2} borderRadius="lg">
          <ReceiptText size={26} />
        </Box>
        <Heading size="2xl">{t('invoices.title')}</Heading>
      </Flex>

      <Tabs.Root
        value={tab}
        onValueChange={(e: { value: string }) => setTab(e.value as Tab)}
        size="lg"
        lazyMount
        unmountOnExit
      >
        <Tabs.List mb={5}>
          <Tabs.Trigger value="sales" flex="1" minH={16} py={2}>
            <Stack gap={0} w="full" align="center">
              <Text fontSize="lg" fontWeight="semibold">
                {t('invoices.salesTab')}
              </Text>
              <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                {t('invoices.salesHint')}
              </Text>
            </Stack>
          </Tabs.Trigger>
          <Tabs.Trigger value="purchases" flex="1" minH={16} py={2}>
            <Stack gap={0} w="full" align="center">
              <Text fontSize="lg" fontWeight="semibold">
                {t('invoices.purchasesTab')}
              </Text>
              <Text fontSize="xs" fontWeight="normal" color="fg.muted">
                {t('invoices.purchasesHint')}
              </Text>
            </Stack>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="sales" p={0}>
          <SalesTab />
        </Tabs.Content>
        <Tabs.Content value="purchases" p={0}>
          <PurchasesTab />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}
