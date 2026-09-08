import buildInfo from '@/lib/build-info.json';
import { formatBuildTime } from '@/lib/formatBuildTime';

export default function Footer() {
  const lastUpdated = formatBuildTime(buildInfo.buildTime);

  return (
    <footer className='bg-gray-100 h-16'>
      <div className='h-full px-2'>
        <div className='flex flex-col items-center justify-center h-full gap-0.5'>
          <p className='text-gray-400 text-xs'>
            &copy; 2026 Modelflick, Inc. All rights reserved.
          </p>
          <p className='text-gray-400 text-[10px]'>
            Last updated: {lastUpdated}
          </p>
        </div>
      </div>
    </footer>
  );
}