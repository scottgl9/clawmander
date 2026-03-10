import { API_URL } from '../../lib/constants';

export default function ImageAttachment({ url, filename }) {
  const src = url.startsWith('http') ? url : `${API_URL}${url}`;
  return (
    <div className="mt-2 max-w-sm">
      <img
        src={src}
        alt={filename || 'attachment'}
        className="rounded-lg max-h-48 object-contain border border-gray-700 cursor-pointer hover:opacity-90 transition-opacity"
        onClick={() => window.open(src, '_blank')}
      />
    </div>
  );
}
