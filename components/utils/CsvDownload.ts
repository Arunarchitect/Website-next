// utils/CsvDownload.ts
export const downloadCSV = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, {
        credentials: "include", // Needed if authenticated via cookies
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access")}`,
        },
      });
  
      if (!response.ok) throw new Error("Download failed");
  
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("❌ Failed to download file:", err);
    }
  };
  