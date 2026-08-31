'use client';

import React, { useState, useRef } from 'react';
import {
  IconX,
  IconUpload,
  IconSparkles,
  IconPhoto,
  IconVideo,
  IconMoodSmile,
  IconClock,
  IconFlame,
  IconHeart,
  IconMusic,
} from '@tabler/icons-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface StoryUploadModalProps {
  onClose: () => void;
  onStoryUploaded: () => void;
}

const QUICK_MOODS = [
  { label: '🔥 Vibing', tag: 'Vibing' },
  { label: '✨ Weekend', tag: 'Weekend' },
  { label: '☕ Coffee Run', tag: 'Coffee Run' },
  { label: '🍕 Foodie', tag: 'Foodie' },
  { label: '🎧 Listening', tag: 'Listening' },
  { label: '✈️ Traveling', tag: 'Traveling' },
];

export default function StoryUploadModal({
  onClose,
  onStoryUploaded,
}: StoryUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Please select an image or video file');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size exceeds 25MB limit');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a photo or video first');
      return;
    }

    setUploading(true);
    try {
      // 1. Upload story media directly to S3 stories folder (without modifying profile photos)
      const storyUploadRes = await api.uploadStoryMedia(selectedFile);
      const mediaUrl = storyUploadRes?.mediaUrl;

      if (!mediaUrl) {
        throw new Error('Failed to retrieve uploaded media URL');
      }

      const isVideo = selectedFile.type.startsWith('video/');
      await api.createStory(mediaUrl, isVideo ? 'video' : 'image', caption.trim());

      toast.success('Your story is live! 🚀');
      onStoryUploaded();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to post story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] bg-gradient-to-tr from-rose-600/20 via-fuchsia-600/15 to-amber-500/20 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-lg bg-neutral-900/95 border border-neutral-800/80 rounded-[15px] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/40 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-fuchsia-600 p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full bg-neutral-950 rounded-[10px] flex items-center justify-center text-rose-400">
                <IconSparkles size={16} />
              </div>
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                Create New Story
              </h3>
              <p className="text-[11px] text-neutral-400 font-medium flex items-center gap-1">
                <IconClock size={12} className="text-amber-400" />
                <span>Expires automatically after 24 hours</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-all cursor-pointer"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Media Preview or Dropzone */}
          {previewUrl ? (
            <div className="relative w-full aspect-[9/13] max-h-[380px] rounded-2xl overflow-hidden bg-black border border-neutral-800 group shadow-inner">
              {selectedFile?.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Story preview"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              )}

              {/* Story Overlay Badges Preview */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider">
                  {selectedFile?.type.startsWith('video/') ? 'Video Story' : 'Photo Story'}
                </span>
              </div>

              {/* Change media button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 px-3.5 py-1.5 bg-black/75 hover:bg-neutral-900 text-xs font-bold text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-lg"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full aspect-[9/11] max-h-[320px] rounded-2xl border-2 border-dashed border-neutral-700/80 hover:border-rose-500/80 bg-neutral-950/50 hover:bg-neutral-900/50 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 group overflow-hidden"
            >
              {/* Subtle background shine */}
              <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative w-16 h-16 rounded-2xl bg-neutral-800/90 border border-neutral-700/80 group-hover:border-rose-500/50 text-neutral-400 group-hover:text-rose-400 flex items-center justify-center mb-3.5 transition-all group-hover:scale-110 shadow-lg">
                <IconPhoto size={32} />
              </div>
              <h4 className="relative text-sm sm:text-base font-bold text-white tracking-tight">
                Upload Photo or Short Video
              </h4>
              <p className="relative text-xs text-neutral-400 mt-1 max-w-[220px]">
                Share a moment with nearby matches today
              </p>

              <div className="relative mt-4 flex items-center gap-2">
                <span className="px-4 py-2 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 group-hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/60 transition-all flex items-center gap-1.5">
                  <IconPhoto size={15} />
                  <span>Choose Media</span>
                </span>
              </div>
            </div>
          )}

          {/* Caption Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Caption
              </label>
              <span className="text-[10px] text-neutral-500 font-medium">
                {caption.length}/120
              </span>
            </div>
            <input
              type="text"
              placeholder="What's happening? Add a caption..."
              value={caption}
              maxLength={120}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-500 outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800/80 bg-neutral-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:opacity-95 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-extrabold rounded-xl transition-all shadow-lg shadow-rose-950/60 cursor-pointer active:scale-95"
          >
            {uploading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Posting Story...</span>
              </>
            ) : (
              <>
                <IconUpload size={16} stroke={2.5} />
                <span>Share Story</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

