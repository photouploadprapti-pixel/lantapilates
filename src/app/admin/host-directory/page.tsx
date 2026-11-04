import type { Metadata } from 'next'

import { HostDirectoryScreen } from '@/components/host-directory-screen'

export const metadata: Metadata = {
  title: 'Host Directory · Lanta Pilates',
}

/** Admin page for the a2hosting LantaVideos folder. */
const HostDirectoryPage = () => <HostDirectoryScreen />

export default HostDirectoryPage
