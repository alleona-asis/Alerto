import React, { useEffect, useState } from 'react';
import { fetchSignedUrl } from '../api/files';

function AdminFiles({ uploadIdPath, uploadLetterPath }) {
  const [idUrl, setIdUrl] = useState(null);
  const [letterUrl, setLetterUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUrls() {
      try {
        if (uploadIdPath) {
          const url = await fetchSignedUrl(uploadIdPath);
          setIdUrl(url);
        }
        if (uploadLetterPath) {
          const url = await fetchSignedUrl(uploadLetterPath);
          setLetterUrl(url);
        }
      } catch (err) {
        setError(err.message);
      }
    }
    loadUrls();
  }, [uploadIdPath, uploadLetterPath]);

  if (error) return <p>Error loading files: {error}</p>;

  return (
    <div>
      {idUrl ? (
        <img src={idUrl} alt="Government ID" style={{ maxWidth: '300px' }} />
      ) : (
        <p>Loading Government ID...</p>
      )}
      {letterUrl ? (
        <a href={letterUrl} target="_blank" rel="noopener noreferrer">
          View Letter of Intent
        </a>
      ) : (
        <p>Loading Letter of Intent...</p>
      )}
    </div>
  );
}

export default AdminFiles;