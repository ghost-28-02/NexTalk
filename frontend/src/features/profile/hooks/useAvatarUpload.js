'use client';

/**
 * useAvatarUpload — file picker + client-side preview + server upload.
 *
 * Responsibilities:
 *   - Open a file picker constrained to image/* types
 *   - Validate file type (image only) and size (≤ 5 MB)
 *   - Generate a local ObjectURL for an instant preview (no upload round-trip needed)
 *   - Upload to POST /users/me/avatar via the updateAvatar RTK mutation
 *   - Clean up the ObjectURL after upload or on unmount to prevent memory leaks
 *   - Expose upload state (isUploading, progress stub) for UI feedback
 *
 * Usage:
 *   const { inputRef, previewUrl, isUploading, error, openFilePicker } = useAvatarUpload();
 *   // Attach inputRef to a hidden <input type="file" ref={inputRef} />
 *   // Call openFilePicker() on button click
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useUpdateAvatarMutation } from '../services/userApi';
import { toast } from 'sonner';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function useAvatarUpload() {
  const inputRef = useRef(null);

  // Local ObjectURL for instant preview before/during upload
  const [previewUrl, setPreviewUrl]   = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const [updateAvatar, { isLoading: isUploading }] = useUpdateAvatarMutation();

  // Clean up ObjectURL on unmount to free memory
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  /** Validate the selected file. Returns an error string or null. */
  function validate(file) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, and GIF images are supported.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'Image must be smaller than 5 MB.';
    }
    return null;
  }

  /** Called when the user selects a file from the picker. */
  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset state
      setUploadError(null);

      const validationError = validate(file);
      if (validationError) {
        setUploadError(validationError);
        toast.error(validationError);
        // Reset the input so the same file can be re-selected after fixing the issue
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      // Generate instant local preview
      const localUrl = URL.createObjectURL(file);
      // Revoke previous preview URL before replacing
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });

      // Build FormData and upload
      const formData = new FormData();
      formData.append('avatar', file);

      try {
        await updateAvatar(formData).unwrap();
        toast.success('Avatar updated successfully');
      } catch (err) {
        const message = err?.data?.message ?? 'Failed to upload avatar. Please try again.';
        setUploadError(message);
        toast.error(message);
        // Clear the preview on failure — show the server avatar again
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }

      // Always reset the file input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    },
    [updateAvatar]
  );

  /** Programmatically open the file picker. */
  const openFilePicker = useCallback(() => {
    if (!isUploading) inputRef.current?.click();
  }, [isUploading]);

  /** Clear the local preview (e.g. when user cancels). */
  const clearPreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  return {
    inputRef,
    previewUrl,
    isUploading,
    uploadError,
    openFilePicker,
    clearPreview,
    handleFileChange,
  };
}
