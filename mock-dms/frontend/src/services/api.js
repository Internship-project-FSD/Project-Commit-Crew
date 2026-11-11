const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

export async function downloadCsv(path, filename) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));

    throw new Error(
      data.message || 'CSV download failed.'
    );
  }

  // Read the filename sent by the backend.
  const disposition = response.headers.get('Content-Disposition');

  const utf8Filename = disposition?.match(
    /filename\*=UTF-8''([^;]+)/i
  )?.[1];

  const regularFilename = disposition?.match(
    /filename="?([^";]+)"?/i
  )?.[1];

  const downloadFilename = utf8Filename
    ? decodeURIComponent(utf8Filename)
    : regularFilename || filename;

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = downloadFilename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}
