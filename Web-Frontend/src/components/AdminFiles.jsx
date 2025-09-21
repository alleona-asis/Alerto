import React, { useEffect, useState } from 'react';
import { fetchSignedUrl } from '../api/files';

const AdminFiles = ({ uploadIdPath, uploadLetterPath }) => {
  const [idUrl, setIdUrl] = useState(null);
  const [letterUrl, setLetterUrl] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    async function loadUrls() {
      try {
        const idSignedUrl = await fetchSignedUrl(uploadIdPath);
        const letterSignedUrl = await fetchSignedUrl(uploadLetterPath);
        setIdUrl(idSignedUrl);
        setLetterUrl(letterSignedUrl);
      } catch (err) {
        setError(err.message);
      }
    }
    if (uploadIdPath && uploadLetterPath) {
      loadUrls();
    }
  }, [uploadIdPath, uploadLetterPath]);
  if (error) {
    return <p style={{ color: 'red' }}>Error loading files: {error}</p>;
  }

   if (!idUrl || !letterUrl) {
    return <p>Loading files...</p>;
  }
  return (
    <>
      <div
        className="document-box"
        onClick={() => window.open(idUrl, '_blank')}
      >
        <img src="/icons/uploaded-id.png" alt="Uploaded ID" className="icon-image" />
        <p className="doc-label">Uploaded ID</p>
      </div>
      <div
        className="document-box"
        onClick={() => window.open(letterUrl, '_blank')}
      >
        <img src="/icons/letter-of-intent.png" alt="Letter of Intent" className="icon-image" />
        <p className="doc-label">Letter of Intent</p>
      </div>
    </>
  );
};

export default AdminFiles;
