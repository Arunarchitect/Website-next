import VideoPlayer from "./components/VideoPlayer";
import { getVideo } from "./api/videoApi";

export default async function VideoPage() {
  const lesson = await getVideo();

  return (
    <main
      style={{
        maxWidth: "1000px",
        margin: "40px auto",
        padding: "20px",
      }}
    >
      <h1>{lesson.title}</h1>
      <p>{lesson.description}</p>

      <VideoPlayer
        src={lesson.video}
        poster={lesson.poster}
        subtitles={lesson.subtitles}
      />
    </main>
  );
}