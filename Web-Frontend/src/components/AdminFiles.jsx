import React, { useEffect, useState } from 'react';
import { fetchSignedUrl } from '../api/files'; // Ensure this is your helper function

const AdminFiles = ({ uploadIdPath, uploadLetterPath }) => {
  const [idUrl, setIdUrl] = useState(null);
  const [letterUrl, setLetterUrl] = useState(null);
  const [loading, setLoading] = useState({ id: false, letter: false });
  const [errors, setErrors] = useState({ id: null, letter: null });

  // Helper to fetch a single URL with error handling
  const loadUrl = async (path, type) => {
    if (!path) return;
    setLoading(prev => ({ ...prev, [type]: true }));
    setErrors(prev => ({ ...prev, [type]: null }));
    try {
      const signedUrl = await fetchSignedUrl(path);
      if (type === 'id') setIdUrl(signedUrl);
      else setLetterUrl(signedUrl);
    } catch (err) {
      setErrors(prev => ({ ...prev, [type]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Load URLs on mount or path change
  useEffect(() => {
    if (uploadIdPath) loadUrl(uploadIdPath, 'id');
    if (uploadLetterPath) loadUrl(uploadLetterPath, 'letter');
  }, [uploadIdPath, uploadLetterPath]);

  // Render helper for each file box
  const renderFileBox = (url, type, label, iconSrc, error, isLoading) => (
    <div
      className="document-box"
      onClick={() => !error && url && window.open(url, '_blank')}
      style={{ cursor: error || isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1 }}
    >
      <img src={iconSrc} alt={label} className="icon-image" />
      <p className="doc-label">{label}</p>
      {isLoading && <p style={{ fontSize: '12px', color: '#999' }}>Loading...</p>}
      {error && (
        <div>
          <p style={{ color: 'red', fontSize: '12px' }}>Error: {error}</p>
          <button onClick={(e) => { e.stopPropagation(); loadUrl(type === 'id' ? uploadIdPath : uploadLetterPath, type); }}>
            Retry
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {renderFileBox(idUrl, 'id', 'Uploaded ID', '/icons/uploaded-id.png', errors.id, loading.id)}
      {renderFileBox(letterUrl, 'letter', 'Letter of Intent', '/icons/letter-of-intent.png', errors.letter, loading.letter)}
    </>
  );
};

export default AdminFiles;