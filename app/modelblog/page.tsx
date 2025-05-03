'use client';

import { useState } from "react";
import { IoChevronDown } from "react-icons/io5"; // Importing the down arrow icon

export default function ModelBlogPage() {
	// Blog data with categories
	const blogPosts = [
		{ id: 1, title: 'Introduction to Sustainable Architecture', category: 'Sustainability' },
		{ id: 2, title: 'Urban Planning in the 21st Century', category: 'Urban Planning' },
		{ id: 3, title: 'Modern Architectural Styles', category: 'Architecture' },
		{ id: 4, title: 'Smart Homes and Future Technologies', category: 'Technology' },
		{ id: 5, title: 'Affordable Housing Solutions', category: 'Housing' },
		{ id: 6, title: 'The Role of Green Spaces in Cities', category: 'Urban Planning' },
		{ id: 7, title: 'Architecture for Climate Change', category: 'Sustainability' },
		{ id: 8, title: 'The Evolution of Building Materials', category: 'Architecture' },
	];

	// Define categories dynamically from the blog data
	const categories = ['All', ...new Set(blogPosts.map(post => post.category))];

	// State for the selected category and search term
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [searchTerm, setSearchTerm] = useState('');
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	// Filter blog posts based on selected category and search term
	const filteredBlogPosts = blogPosts.filter(post => {
		const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
		const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			post.category.toLowerCase().includes(searchTerm.toLowerCase());
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
					This ModelBlog section is under development. Explore insightful articles on architecture, planning, and more.
				</p>
			</div>

			<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">ModelBlog</h1>

			{/* Search Bar with Dropdown Arrow */}
			<div className="relative mb-6">
				<div className="flex items-center">
					<label htmlFor="search" className="text-lg font-semibold text-gray-800 dark:text-gray-100">Search Blogs</label>
					<input
						id="search"
						type="text"
						className="mt-2 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-full pr-10"
						placeholder="Search by blog title or category"
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

			{/* Blog Posts Display */}
			<div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mt-6">
				{filteredBlogPosts.map(post => (
					<div
						key={post.id}
						className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 flex items-center justify-center aspect-square hover:shadow-md transition"
					>
						<h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 text-center">
							{post.title}
						</h2>
					</div>
				))}
			</div>
		</div>
	);
}
