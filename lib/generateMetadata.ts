import { Metadata } from 'next';

type GenerateMetadataProps = {
  title: string;
  description?: string;
  imageText?: string;
};

export function generateMetadata({ 
  title, 
  description = "Modelflick page", 
  imageText = title 
}: GenerateMetadataProps): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_HOST || 'https://api.modelflick.com';
  const imageUrl = `${baseUrl}/api/og?text=${encodeURIComponent(imageText)}`;

  return {
    // ⚡ raw title only → layout template adds "| Modelflick"
    title, 
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl], // ✅ simple string array
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl], // ✅ simple string array
    },
  };
}
