export async function fetchSignedUrl(filePath) {
  const response = await fetch(`/api/files/signed-url?filePath=${encodeURIComponent(filePath)}`, {
    cache: 'no-store' // prevent browser cache
  });

  if (response.status === 304) {
    // Optionally refetch or throw error
    throw new Error('Resource not modified - no new signed URL');
  }

  if (!response.ok) {
    const text = await response.text();
    console.error('Failed to fetch signed URL, response:', text);
    throw new Error('Failed to fetch signed URL');
  }
  const data = await response.json();
  return data.signedUrl;
}
