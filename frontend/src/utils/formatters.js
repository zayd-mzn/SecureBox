export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

export const getFileTypeIcon = (type) => {
  const icons = {
    document: 'fa-file-alt',
    image: 'fa-image',
    video: 'fa-video',
    audio: 'fa-music',
    archive: 'fa-file-archive',
    other: 'fa-file'
  };
  return icons[type] || 'fa-file';
};

export const getActivityIcon = (action) => {
  const icons = {
    upload: 'fa-cloud-upload-alt',
    download: 'fa-cloud-download-alt',
    share: 'fa-share-alt',
    delete: 'fa-trash-alt',
    edit: 'fa-edit'
  };
  return icons[action] || 'fa-file';
};