export interface Subtitle {
  label: string;
  language: string;
  src: string;
  default?: boolean;
}

export interface VideoLesson {
  id: number;
  title: string;
  description: string;
  video: string;
  poster: string;
  subtitles: Subtitle[];
}

export async function getVideo(): Promise<VideoLesson> {
  return {
    id: 1,
    title: "Blender Basics - Lesson 1",
    description: "This is a demo lesson using the video player.",
    video: "/videos/lesson1/test.mp4",
    poster: "/videos/lesson1/poster.jpg",
    subtitles: [
      {
        label: "English",
        language: "en",
        src: "/videos/lesson1/subtitles/english.vtt",
        default: true,
      },
    ],
  };
}