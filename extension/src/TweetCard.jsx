import React from 'react';
import { MessageCircle, Repeat2, Heart, BarChart2, Share, BadgeCheck } from 'lucide-react';

const TweetCard = ({ rec }) => {
  return (
    <article className="px-4 pt-3 pb-2 border-b border-[rgb(47,51,54)] hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-colors flex flex-row">
      {/* Avatar column */}
      <div className="mr-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-[#1d9bf0] flex items-center justify-center text-white font-bold text-lg">
          {rec.created_by.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Content column */}
      <div className="flex flex-col flex-1 pb-1">
        {/* Header (Name, Handle, Time) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 text-[15px]">
            <span className="font-bold text-[#e7e9ea] hover:underline">@{rec.created_by}</span>
            <BadgeCheck className="w-4 h-4 text-[#1d9bf0] shrink-0" />
            <span className="text-[#71767b]">@{rec.created_by}</span>
            <span className="text-[#71767b]">·</span>
            <span className="text-[#71767b] hover:underline">Now</span>
          </div>
        </div>

        {/* AI Score Badge */}
        <div className="mt-1 mb-2">
            <span className="inline-block bg-[#1d9bf0]/10 text-[#1d9bf0] px-2 py-0.5 rounded text-[12px] font-bold border border-[#1d9bf0]/20">
                Agent Match Score: {rec.score}/10
            </span>
        </div>

        {/* Tweet Text */}
        <div className="text-[#e7e9ea] text-[15px] leading-relaxed whitespace-pre-wrap mt-1">
          {rec.tweet}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-3 text-[#71767b] max-w-[425px]">
          <div className="flex items-center group cursor-pointer">
            <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 group-hover:text-[#1d9bf0] transition-colors">
              <MessageCircle className="w-4 h-4" />
            </div>
            <span className="text-[13px] px-1 group-hover:text-[#1d9bf0]">0</span>
          </div>
          
          <div className="flex items-center group cursor-pointer">
            <div className="p-2 rounded-full group-hover:bg-[#00ba7c]/10 group-hover:text-[#00ba7c] transition-colors">
              <Repeat2 className="w-4 h-4" />
            </div>
            <span className="text-[13px] px-1 group-hover:text-[#00ba7c]">0</span>
          </div>

          <div className="flex items-center group cursor-pointer">
            <div className="p-2 rounded-full group-hover:bg-[#f91880]/10 group-hover:text-[#f91880] transition-colors">
              <Heart className="w-4 h-4" />
            </div>
            <span className="text-[13px] px-1 group-hover:text-[#f91880]">0</span>
          </div>

          <div className="flex items-center group cursor-pointer">
            <div className="p-2 rounded-full group-hover:bg-[#1d9bf0]/10 group-hover:text-[#1d9bf0] transition-colors">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="text-[13px] px-1 group-hover:text-[#1d9bf0]">0</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full hover:bg-[#1d9bf0]/10 hover:text-[#1d9bf0] cursor-pointer transition-colors">
              <Share className="w-4 h-4" />
            </div>
            {rec.link && (
              <a 
                href={rec.link} 
                target="_blank" 
                rel="noreferrer"
                className="text-[#1d9bf0] text-[14px] hover:underline flex items-center"
              >
                View Post
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default TweetCard;
