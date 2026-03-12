import { useState } from 'react'

export function useNavGroups() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  return { activeGroup, setActiveGroup } as const
}
