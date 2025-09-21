export async function fetchSignedUrl(filePath) {
  const response = await fetch(`/api/files/signed-url?filePath=${encodeURIComponent(filePath)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch signed URL');
  }
  const data = await response.json();
  return data.signedUrl;
}
