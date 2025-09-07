interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export default function SearchBar({ 
  searchTerm, 
  onSearchChange 
}: SearchBarProps) {
  return (
    <input
      type="text"
      placeholder="Search reels..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      className="mb-6 w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}