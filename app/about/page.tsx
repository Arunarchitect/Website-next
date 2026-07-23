// app/about/page.tsx
import { generateMetadata } from '@/lib/generateMetadata';

export const metadata = generateMetadata({
  title: 'About',
  description: 'Modelflick is a platform exploring new approaches to planning and architectural design.We re developing tools to help communities better understand and engage with their built environments, with a focus on accessibility and collaboration.',
  imageText: 'About',
});

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">About Modelflick</h1>
      
      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <p>
          Modelflick is a design technology initiative born from the friction of practice—the 
          persistent gap between conception, coordination, and realization that defines much of 
          contemporary planning and architectural work. What began as a pragmatic toolkit assembled 
          by Arun.M.R. to navigate the daily complexities of translating between drawings, models, 
          and on-site discourse has since evolved into a broader mission: reimagining how communities 
          perceive, participate in, and shape their built environments.
        </p>

        <p>
          At its core, Modelflick is animated by a conviction that the tools of design should not 
          remain the privileged domain of specialists. We are committed to open-source frameworks 
          and accessible technologies that democratize the planning process, enabling more inclusive 
          and transparent dialogue between practitioners and the publics they serve. Our work 
          seeks to transform engagement from a procedural formality into a substantive, ongoing 
          conversation.
        </p>

        <p>
          We champion open standards and interoperable systems as essential infrastructure for 
          more thoughtful, adaptive, and human-centered places. By cultivating new modes of 
          knowledge-sharing and collaborative inquiry, we aspire to contribute not merely to 
          better buildings or plans, but to a richer, more participatory culture of placemaking—one 
          that recognizes the built environment as a shared inheritance and a collective responsibility.
        </p>
      </div>
    </div>
  );
}