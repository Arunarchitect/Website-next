import { useState, useEffect, useCallback, useMemo } from 'react';
import { ProjectData, ViewerData } from '../types/panorama';

export const usePanorama = (code: string) => {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedView, setSelectedView] = useState<ViewerData | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  const fetchProjectData = useCallback(async (key: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`https://api.modelflick.com/api/viewer/public/360-images/${key}/`);
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid access key');
        throw new Error('Failed to fetch project data');
      }
      
      const data: ProjectData = await response.json();
      setProjectData(data);
      if (data["360_images"].length > 0) {
        setSelectedView(data["360_images"][0]);
        setCurrentImageIndex(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewSelect = useCallback((view: ViewerData) => {
    setSelectedView(view);
    setUploadedImage(null);
    if (projectData) {
      const index = projectData["360_images"].findIndex(v => v.id === view.id);
      setCurrentImageIndex(index);
    }
  }, [projectData]);

  const navigateImages = useCallback((direction: 'next' | 'prev') => {
    if (!projectData || projectData["360_images"].length <= 1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = (currentImageIndex + 1) % projectData["360_images"].length;
    } else {
      newIndex = (currentImageIndex - 1 + projectData["360_images"].length) % projectData["360_images"].length;
    }

    setCurrentImageIndex(newIndex);
    setSelectedView(projectData["360_images"][newIndex]);
  }, [projectData, currentImageIndex]);

  const getCurrentImage = useCallback(() => 
    uploadedImage || selectedView?.image_360 || null, 
    [uploadedImage, selectedView]
  );

  const getCurrentImageName = useCallback(() => {
    if (uploadedImage) return 'Uploaded Image';
    if (selectedView) return selectedView.view_name;
    return '';
  }, [uploadedImage, selectedView]);

  // Add the missing hasImageLoaded property
  const hasImageLoaded = useMemo(() => {
    return !!(uploadedImage || selectedView);
  }, [uploadedImage, selectedView]);

  useEffect(() => {
    if (code) {
      fetchProjectData(code);
    }
  }, [code, fetchProjectData]);

  return {
    projectData,
    selectedView,
    uploadedImage,
    loading,
    error,
    currentImageIndex,
    setUploadedImage,
    setError,
    handleViewSelect,
    navigateImages,
    getCurrentImage,
    getCurrentImageName,
    hasImageLoaded, // This was missing
    hasMultipleImages: projectData && projectData["360_images"].length > 1
  };
};