'use client';

import { useState } from "react";
import { IoChevronDown } from "react-icons/io5"; // Importing a down arrow icon from react-icons

export default function CoursesPage() {
	// Course data with categories
	const courses = [
		{ id: 1, title: 'Introduction to 3D Modeling', category: 'Computer Graphics' },
		{ id: 2, title: 'Introduction to 3D Modeling', category: 'Computer Graphics' },
		{ id: 3, title: 'Advanced Blender Techniques', category: 'Computer Graphics' },
		{ id: 4, title: 'Architectural Presentation Basics', category: 'Architecture' },
		{ id: 5, title: 'BIM Fundamentals', category: 'BIM' },
		{ id: 6, title: 'Interior Design Essentials', category: 'Interior Design' },
		{ id: 7, title: 'Urban Planning 101', category: 'Urban Planning' },
		{ id: 8, title: 'AutoCAD Masterclass', category: 'Computer Graphics' },
		{ id: 9, title: 'Parametric Design with Grasshopper', category: 'Computer Graphics' },
	];

	// Define categories dynamically from the course data
	const categories = ['All', ...new Set(courses.map(course => course.category))];

	// State for the selected category and search term
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [searchTerm, setSearchTerm] = useState('');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	// Filter courses based on selected category and search term
	const filteredCourses = courses.filter(course => {
		const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
		const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			course.category.toLowerCase().includes(searchTerm.toLowerCase());
		return matchesCategory && matchesSearch;
	});

	// Filter categories based on the search term
	const filteredCategories = categories.filter(category => 
		category.toLowerCase().includes(searchTerm.toLowerCase())
	);

	return (
		<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
			<div className="mb-6 p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 rounded-md">
				<p className="text-sm">
					This section is under development. This is a trial sketch for the Courses page.
				</p>
			</div>

			<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">Courses</h1>

			{/* Search Bar with Dropdown Arrow */}
			<div className="relative mb-6">
				<div className="flex items-center">
					<label htmlFor="search" className="text-lg font-semibold text-gray-800 dark:text-gray-100">Search Courses</label>
					<input
						id="search"
						type="text"
						className="mt-2 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full pr-10"
						placeholder="Search by course name or category"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
					
					{/* Down Arrow Icon inside the search bar */}
					<IoChevronDown
						onClick={() => setIsDropdownOpen(!isDropdownOpen)}
						className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-300 cursor-pointer"
					/>
				</div>

				{/* Dropdown Menu */}
				{isDropdownOpen && (
					<div className="absolute mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-10 w-full">
						{filteredCategories.map((category, index) => (
							<button
								key={index}
								className="w-full text-left p-2 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
								onClick={() => {
									setSelectedCategory(category);
									setIsDropdownOpen(false);  // Close the dropdown after selection
								}}
							>
								{category}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Courses Display */}
			<div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mt-6">
				{filteredCourses.map(course => (
					<div
						key={course.id}
						className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex items-center justify-center aspect-square hover:shadow-md transition"
					>
						<h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 text-center">
							{course.title}
						</h2>
					</div>
				))}
			</div>
		</div>
	);
}
