import React, { useState } from 'react';

interface AuthorAvatarProps {
  name: string;
  /** users.avatar_url sent by the API as author_avatar; may be absent. */
  src?: string;
  /** Sizing, shape and colours of the circle (also used for the initial). */
  className: string;
}

/**
 * Author's profile photo for article and tip bylines. Falls back to the
 * name's initial when the author has no photo or the file fails to load.
 */
const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ name, src, className }) => {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${className} object-cover`}
      />
    );
  }

  return <div className={className}>{name.charAt(0)}</div>;
};

export default AuthorAvatar;
