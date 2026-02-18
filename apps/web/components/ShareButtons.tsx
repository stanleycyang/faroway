'use client';

import React, { useState } from 'react';
import { Share2, Twitter, Facebook, Linkedin, Link2, Check, Mail, MessageCircle } from 'lucide-react';

interface ShareButtonsProps {
  url?: string;
  title: string;
  description?: string;
  hashtags?: string[];
  className?: string;
  compact?: boolean;
}

export function ShareButtons({
  url,
  title,
  description = '',
  hashtags = ['TripGenie', 'TravelPlanning', 'AI'],
  className = '',
  compact = false,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const hashtagString = hashtags.join(',');

  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtagString}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed');
      }
    } else {
      setShowDropdown(!showDropdown);
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, '_blank', 'width=600,height=400,scrollbars=yes');
    setShowDropdown(false);
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleNativeShare}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5 text-gray-600" />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 min-w-[200px]">
            <div className="p-2">
              <button
                onClick={() => openShareWindow(shareLinks.twitter)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Twitter className="w-4 h-4 text-[#1DA1F2]" />
                <span className="text-sm text-gray-700">Twitter</span>
              </button>
              <button
                onClick={() => openShareWindow(shareLinks.facebook)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Facebook className="w-4 h-4 text-[#1877F2]" />
                <span className="text-sm text-gray-700">Facebook</span>
              </button>
              <button
                onClick={() => openShareWindow(shareLinks.linkedin)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                <span className="text-sm text-gray-700">LinkedIn</span>
              </button>
              <button
                onClick={() => openShareWindow(shareLinks.whatsapp)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span className="text-sm text-gray-700">WhatsApp</span>
              </button>
              <a
                href={shareLinks.email}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Email</span>
              </a>
              <hr className="my-2 border-gray-100" />
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700">Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <span className="text-sm text-gray-500 mr-1">Share:</span>
      
      <button
        onClick={() => openShareWindow(shareLinks.twitter)}
        className="p-2.5 rounded-full bg-[#1DA1F2] text-white hover:bg-[#1a8cd8] transition-colors"
        aria-label="Share on Twitter"
      >
        <Twitter className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => openShareWindow(shareLinks.facebook)}
        className="p-2.5 rounded-full bg-[#1877F2] text-white hover:bg-[#166fe5] transition-colors"
        aria-label="Share on Facebook"
      >
        <Facebook className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => openShareWindow(shareLinks.linkedin)}
        className="p-2.5 rounded-full bg-[#0A66C2] text-white hover:bg-[#095196] transition-colors"
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => openShareWindow(shareLinks.whatsapp)}
        className="p-2.5 rounded-full bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors"
        aria-label="Share on WhatsApp"
      >
        <MessageCircle className="w-4 h-4" />
      </button>
      
      <button
        onClick={handleCopyLink}
        className={`p-2.5 rounded-full transition-all ${
          copied 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        aria-label={copied ? 'Link copied' : 'Copy link'}
      >
        {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

// Hook for programmatic sharing
export function useShare() {
  const share = async (data: { title: string; text?: string; url: string }) => {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return true;
      } catch {
        return false;
      }
    }
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      return true;
    } catch {
      return false;
    }
  };

  return { share, canShare: typeof navigator !== 'undefined' && !!navigator.share };
}
