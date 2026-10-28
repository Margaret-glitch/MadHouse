import React, { useState, useEffect } from 'react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ 
  src, 
  fallbackSrc,
  className,
  alt = 'Poster',
  ...props 
}) => {
  // Generate a clean dark gradient SVG placeholder if no fallback is provided
  const defaultPoster = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#141414"/>
          <stop offset="100%" stop-color="#0a0a0a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#g)"/>
      <circle cx="400" cy="225" r="40" fill="#E5C058" opacity="0.2"/>
      <polygon points="390,205 420,225 390,245" fill="#E5C058"/>
      <text x="50%" y="82%" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.8">${alt.replace(/[<>&'"]/g, '')}</text>
    </svg>`
  )}`;

  const resolvedFallback = fallbackSrc || defaultPoster;
  const [imgSrc, setImgSrc] = useState<string | undefined>(src || resolvedFallback);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src || resolvedFallback);
    setHasError(false);
  }, [src, resolvedFallback]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(resolvedFallback);
    }
  };

  return (
    <img
      {...props}
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};
