// src/app/about/page.tsx

import React from 'react';

const About: React.FC = () => {
  return (
    <div className="bg-black text-white min-h-screen flex flex-col justify-center items-center">
      <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-9xl xl:text-9xl uppercase font-extrabold">
        Contact
      </h1>
      <p className="text-lg sm:text-xl mt-4 text-center">
        This is the about page where we talk about our company.
      </p>
    </div>
  );
};

export default About;
