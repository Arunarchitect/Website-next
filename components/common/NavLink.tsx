'use client';

import Link from 'next/link';
import cn from 'classnames';
import { ReactNode, MouseEvent } from 'react';

interface Props {
  isSelected?: boolean;
  isMobile?: boolean;
  isBanner?: boolean;
  href?: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement | HTMLSpanElement>) => void;
  leadingIcon?: ReactNode;
}

export default function NavLink({
  isSelected,
  isMobile,
  isBanner,
  href,
  children,
  className,
  onClick,
  leadingIcon,
  ...rest
}: Props) {
  const combinedClassName = cn(
    className,
    'inline-flex items-center gap-1.5 text-white rounded-md px-3 py-2 font-medium',
    {
      'bg-gray-900': isSelected,
      'text-gray-300 hover:bg-gray-700 hover:text-white': !isSelected && !isBanner,
      'block text-base': isMobile,
      'text-sm': !isMobile,
      'text-gray-300': isBanner,
    }
  );

  const content = (
    <>
      {leadingIcon}
      {children}
    </>
  );

  if (!href) {
    return (
      <span className={combinedClassName} role="button" onClick={onClick} {...rest}>
        {content}
      </span>
    );
  }

  return (
    <Link href={href} className={combinedClassName} onClick={onClick} {...rest}>
      {content}
    </Link>
  );
}