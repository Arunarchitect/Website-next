'use client';

import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { useLogoutMutation } from '@/redux/features/authApiSlice';
import { logout as setLogout } from '@/redux/features/authSlice';
import { NavLink } from '@/components/common';

export default function Navbar() {
	const pathname = usePathname();
	const dispatch = useAppDispatch();

	const [logout] = useLogoutMutation();
	const { isAuthenticated } = useAppSelector(state => state.auth);

	const handleLogout = () => {
		logout(undefined)
			.unwrap()
			.then(() => {
				dispatch(setLogout());
			});
	};

	const isSelected = (path: string) => pathname === path;

	const toolsLink = (isMobile: boolean) => (
		<NavLink
			isSelected={isSelected('/tools')}
			isMobile={isMobile}
			href='/tools'
		>
			Tools
		</NavLink>
	);

	const coursesLink = (isMobile: boolean) => (
		<NavLink
			isSelected={isSelected('/courses')}
			isMobile={isMobile}
			href='/courses'
		>
			Courses
		</NavLink>
	);

	const modelBlogLink = (isMobile: boolean) => (
		<NavLink
			isSelected={isSelected('/modelblog')}
			isMobile={isMobile}
			href='/modelblog'
		>
			ModelBlog
		</NavLink>
	);

	const authLinks = (isMobile: boolean) => (
		<>
			{toolsLink(isMobile)}
			{coursesLink(isMobile)}
			{modelBlogLink(isMobile)} {/* Add ModelBlog Link */}
			<NavLink
				isSelected={isSelected('/dashboard')}
				isMobile={isMobile}
				href='/dashboard'
			>
				Dashboard
			</NavLink>
			<NavLink isMobile={isMobile} onClick={handleLogout}>
				Logout
			</NavLink>
		</>
	);

	const guestLinks = (isMobile: boolean) => (
		<>
			{toolsLink(isMobile)}
			{coursesLink(isMobile)}
			{modelBlogLink(isMobile)} {/* Add ModelBlog Link */}
			<NavLink
				isSelected={isSelected('/auth/login')}
				isMobile={isMobile}
				href='/auth/login'
			>
				Login
			</NavLink>
			<NavLink
				isSelected={isSelected('/auth/register')}
				isMobile={isMobile}
				href='/auth/register'
			>
				Register
			</NavLink>
		</>
	);

	return (
		<Disclosure as='nav' className='bg-gray-800'>
			{({ open }) => (
				<>
					<div className='mx-auto max-w-7xl px-2 sm:px-6 lg:px-8'>
						<div className='relative flex h-16 items-center justify-between'>
							<div className='absolute inset-y-0 left-0 flex items-center sm:hidden'>
								<DisclosureButton className='inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white'>
									<span className='sr-only'>Open main menu</span>
									{open ? (
										<XMarkIcon className='block h-6 w-6' aria-hidden='true' />
									) : (
										<Bars3Icon className='block h-6 w-6' aria-hidden='true' />
									)}
								</DisclosureButton>
							</div>
							<div className='flex flex-1 items-center justify-center sm:items-stretch sm:justify-start'>
								<div className='flex flex-shrink-0 items-center'>
									<NavLink href='/' isBanner>
										Modelflick
									</NavLink>
								</div>
								<div className='hidden sm:ml-6 sm:block'>
									<div className='flex space-x-4'>
										{isAuthenticated ? authLinks(false) : guestLinks(false)}
									</div>
								</div>
							</div>
						</div>
					</div>

					<DisclosurePanel className='sm:hidden'>
						<div className='space-y-1 px-2 pb-3 pt-2'>
							{isAuthenticated ? authLinks(true) : guestLinks(true)}
						</div>
					</DisclosurePanel>
				</>
			)}
		</Disclosure>
	);
}
