import { generateMetadata } from '@/lib/generateMetadata';
import DonateClient from './DonateClient';

// ✅ Server-only metadata export
export const metadata = generateMetadata({
  title: 'Donate',
  description: 'Support the OpenSource ecosystem through Modelflick with a donation.',
  imageText: 'Donate',
});

export default function DonatePage() {
  return <DonateClient />;
}
