// app/about/page.tsx
export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">About ModelFlick</h1>
      
      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <p>
          ModelFlick is a platform exploring new approaches to planning and architectural design.
          We&apos;re developing tools to help communities better understand and engage with their
          built environments, with a focus on accessibility and collaboration.
        </p>

        <p>
          We support open-source initiatives and believe in making design technologies more
          accessible. Our work aims to facilitate dialogue between professionals and communities
          throughout the planning process.
        </p>

        <p>
          We&apos;re interested in open standards and interoperable systems that can help improve
           spaces and life. By exploring new ways to share knowledge, we hope to contribute to more
          thoughtful approaches to planning and designing.
        </p>
      </div>
    </div>
  );
}