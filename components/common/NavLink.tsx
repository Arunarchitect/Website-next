'use client';

import Link from 'next/link';
import cn from 'classnames';
import { ReactNode } from 'react';

interface Props {
  isSelected?: boolean;
  isMobile?: boolean;
  isBanner?: boolean;
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function NavLink({
  isSelected,
  isMobile,
  isBanner,
  href,
  children,
  className,
  onClick,
  ...rest
}: Props) {
  const combinedClassName = cn(
    className,
    'text-white rounded-md px-3 py-2 font-medium',
    {
      'bg-gray-900': isSelected,
      'text-gray-300 hover:bg-gray-700 hover:text-white': !isSelected && !isBanner,
      'block text-base': isMobile,
      'text-sm': !isMobile,
      'text-gray-300': isBanner,
    }
  );

  if (!href) {
    return (
      <span className={combinedClassName} role="button" onClick={onClick} {...rest}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={combinedClassName} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
