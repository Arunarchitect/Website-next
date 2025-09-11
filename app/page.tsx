import HomePage from './HomePage';
import { generateMetadata } from '@/lib/generateMetadata';

export const metadata = generateMetadata({
  title: 'Home',
  description: 'Modelflick home page',
  imageText: 'Home',
});

export default function Page() {
  return <HomePage />;
}
