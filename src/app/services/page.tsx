// src/app/about/page.tsx

import React from 'react';
import Link from 'next/link';

const About: React.FC = () => {
  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-center items-center">
      <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl xl:text-9xl uppercase font-extrabold">
        Services
      </h1>
      <p className="text-lg sm:text-xl mt-4 text-center">
        You can use our free tools to make your tasks completed in seconds.
      </p>

      {/* Buttons section */}
      <div className="flex space-x-4 mt-8">
        {/* Fee Calculator Button */}
        <Link href="/fee-calculator">
          <button className="bg-white text-black py-2 px-6 rounded-lg text-xl uppercase font-bold hover:bg-gray-200 transition duration-300">
            Fee Calculator
          </button>
        </Link>
      </div>
    </div>
  );
};

export default About;
